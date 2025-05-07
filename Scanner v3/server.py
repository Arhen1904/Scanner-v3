from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from paddleocr import PaddleOCR
from PIL import Image
import io
import numpy as np
import re

app = Flask(__name__)
CORS(app)

# OCR global reutilizable
ocr_global = PaddleOCR(use_angle_cls=True, lang='latin', use_gpu=False)

def safe_ocr(image_np):
    global ocr_global
    try:
        result = ocr_global.ocr(image_np, cls=True)
    except Exception as e:
        print("Error con OCR actual, reiniciando:", e)
        ocr_global = PaddleOCR(use_angle_cls=True, lang='latin', use_gpu=False)
        result = ocr_global.ocr(image_np, cls=True)
    return result

def extract_invoice_data(text):
    keywords = [
        "base", "impuesto", "subtotal", "total", "iva",
        "neto", "tax", "amount", "value", "total due", "vat"
    ]
    lines = text.splitlines()
    invoice_data = []
    currency_symbols_regex = re.compile(r"(\s)?(US\$|\$|€|¥|₡|₱|₹)", re.IGNORECASE)

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        clean = line.lower()

        # ¿es una línea de clave?
        matched_kw = next((kw for kw in keywords if kw in clean), None)
        if matched_kw:
            # Tratamos de extraer número de la misma línea
            m = re.search(r"([0-9]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)", line)
            if not m and i + 1 < len(lines):
                # Si no lo encontramos, probamos en la línea siguiente
                next_line = lines[i + 1]
                m = re.search(r"([0-9]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)", next_line)
                if m:
                    # avanzamos un paso extra para no volver a procesar esa línea
                    i += 1
                    line = next_line

            if m:
                label = matched_kw.capitalize()
                amt = m.group(1).replace(",", ".")
                amt = re.sub(currency_symbols_regex, "", amt).strip()
                invoice_data.append(f"{label},{amt}")

        i += 1

    if invoice_data:
        return "Nombre,Monto\n" + "\n".join(invoice_data)
    return None


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ocr', methods=['POST'])
def ocr_route():
    image_file = request.files.get('image')
    # Leer el checkbox como cadena y compararlo
    filter_str = request.form.get('filter', 'false')
    filter_flag = filter_str.lower() == 'true'

    if not image_file:
        return jsonify({"error": "No image provided"}), 400

    try:
        img = Image.open(io.BytesIO(image_file.read())).convert("RGB")
        image_np = np.array(img)
        result = safe_ocr(image_np)

        # Construir el texto detectado
        text = ""
        if result and result[0]:
            for line in result[0]:
                text += line[1][0] + "\n"
        else:
            text = "(No se detectó texto)"

        print("OCR text:", text)  # depuración

        if filter_flag:
            invoice_data = extract_invoice_data(text)
            if invoice_data:
                return jsonify({"text": invoice_data})
            else:
                return jsonify({"text": "No se encontraron datos de factura."})
        else:
            return jsonify({"text": text})

    except Exception as e:
        print("Error procesando imagen:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5000)
