from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from paddleocr import PaddleOCR
from PIL import Image
import io
import numpy as np
import re
import os

# Configuración del servidor
app = Flask(__name__)
# Ajuste CORS: permite solo el frontend específico (ajusta según tu dominio)
CORS(app, resources={r"/*": {"origins": ["https://scanner-v3-orba7y3i9-arhens-projects.vercel.app"]}})

# Añadir cabeceras CORS en todas las respuestas
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://scanner-v3-orba7y3i9-arhens-projects.vercel.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

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

    for line in lines:
        clean = line.lower()
        matched_kw = next((kw for kw in keywords if kw in clean), None)
        if matched_kw:
            m = re.search(r"([0-9]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)", line)
            if m:
                label = matched_kw.capitalize()
                amt = m.group(1).replace(",", ".")
                amt = re.sub(currency_symbols_regex, "", amt).strip()
                invoice_data.append(f"{label},{amt}")

    return "Nombre,Monto\n" + "\n".join(invoice_data) if invoice_data else None

@app.route('/')
def home():
    return jsonify({"message": "API OCR is running"}), 200

@app.route('/ocr', methods=['POST', 'OPTIONS'])
def ocr_route():
    if request.method == 'OPTIONS':
        # Responder a preflight CORS
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'https://scanner-v3-orba7y3i9-arhens-projects.vercel.app')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        return response

    image_file = request.files.get('image')
    filter_flag = request.form.get('filter', 'false').lower() == 'true'

    if not image_file:
        return jsonify({"error": "No image provided"}), 400

    try:
        img = Image.open(io.BytesIO(image_file.read())).convert("RGB")
        image_np = np.array(img)
        result = safe_ocr(image_np)

        text = "\n".join([line[1][0] for line in result[0]]) if result and result[0] else "(No se detectó texto)"
        print("Texto detectado:", text)

        if filter_flag:
            invoice_data = extract_invoice_data(text)
            return jsonify({"text": invoice_data}) if invoice_data else jsonify({"text": "No se encontraron datos de factura."})

        return jsonify({"text": text})

    except Exception as e:
        print("Error procesando imagen:", e)
        return jsonify({"error": str(e)}), 500

# Nota: se quita el bloque app.run() para que Gunicorn maneje la app
