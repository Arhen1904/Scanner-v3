let cameraActive = false;
let videoStream = null;
let availableDevices = [];
let currentDeviceIndex = 0;

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const imageInput = document.getElementById("imageInput");
  const file = imageInput.files[0];

  if (!file) {
    alert("Por favor, selecciona una imagen.");
    return;
  }

  processImage(file);
});

// Mostrar/ocultar botones según si hay imagen seleccionada
document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  const analyzeButton = document.getElementById("analyzeButton");
  const clearButton = document.getElementById("clearImageButton");

  // Manejo del cambio de selección de imagen
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (file) {
      analyzeButton.style.display = "inline-block";
      clearButton.style.display = "inline-block";
      showImageThumbnail(file);
    } else {
      analyzeButton.style.display = "none";
      clearButton.style.display = "none";
      document.getElementById("imagePreview").style.display = "none";
    }
  });

  // Botón para limpiar la selección y resultados
  clearButton.addEventListener("click", () => {
    imageInput.value = "";
    analyzeButton.style.display = "none";
    clearButton.style.display = "none";

    const resultDiv = document.getElementById("result");
    resultDiv.textContent = "";
    resultDiv.style.display = "none";

    document.getElementById("editableData").value = "";
    document.getElementById("invoicePreview").style.display = "none";
    document.getElementById("downloadCSVButton").style.display = "none";

    const imagePreview = document.getElementById("imagePreview");
    imagePreview.style.display = "none";
    imagePreview.classList.remove("show");
  });

  // Registro único del listener de descarga CSV
  const downloadButton = document.getElementById("downloadCSVButton");
  downloadButton.addEventListener(
    "click",
    () => {
      const previewArea = document.getElementById("editableData");
      const csvContent = "data:text/csv;charset=utf-8," + previewArea.value;
      const encodedUri = encodeURI(csvContent);

      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "factura.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    { once: true }
  );

  // Cámaras y captura de imagen
  document
    .getElementById("toggleCamera")
    .addEventListener("click", toggleCamera);
  document
    .getElementById("switchCamera")
    .addEventListener("click", switchCamera);
  document
    .getElementById("captureButton")
    .addEventListener("click", captureImage);
  document
    .getElementById("acceptButton")
    .addEventListener("click", acceptImage);
  document
    .getElementById("cancelButton")
    .addEventListener("click", cancelImage);
});

// NUEVA FUNCIÓN: Mostrar miniatura de imagen seleccionada
function showImageThumbnail(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.getElementById("imagePreview");
    img.src = e.target.result;

    // Quitar la clase por si ya estaba aplicada
    img.classList.remove("show");

    // Mostrar la imagen (inicialmente con opacity: 0 y scale: 0.95)
    img.style.display = "block";

    // Esperar un frame antes de agregar la clase que dispara la animación
    requestAnimationFrame(() => {
      img.classList.add("show");
    });
  };

  reader.readAsDataURL(file);
}

// Obtener las cámaras disponibles
async function getVideoDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

// Cambiar entre cámaras
async function switchCamera() {
  if (!availableDevices.length) return;
  currentDeviceIndex = (currentDeviceIndex + 1) % availableDevices.length;
  const deviceId = availableDevices[currentDeviceIndex].deviceId;
  await startCamera(deviceId);
}

// Iniciar la cámara
async function startCamera(deviceId = null) {
  const video = document.getElementById("video");

  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
  }

  const constraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: "environment" },
  };

  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;

    await new Promise((resolve) => {
      video.onloadedmetadata = async () => {
        video.play();

        const [track] = videoStream.getVideoTracks();
        const capabilities = track.getCapabilities?.();

        if (capabilities && capabilities.focusMode) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            });
            console.log("Enfoque automático activado");
          } catch (e) {
            console.warn("No se pudo activar el enfoque automático:", e);
          }
        }

        const settings = track.getSettings?.();
        const isFrontCamera =
          settings.facingMode === "user" || currentDeviceIndex !== 0;
        video.style.transform = isFrontCamera ? "scaleX(-1)" : "scaleX(1)";
        resolve();
      };
    });
  } catch (err) {
    console.error("Error al iniciar cámara:", err);
    alert("No se pudo acceder a la cámara.");
  }
}

// Activar/desactivar cámara
async function toggleCamera() {
  const video = document.getElementById("video");
  const canvasContainer = document.getElementById("canvasContainer");
  const toggleButton = document.getElementById("toggleCamera");
  const switchButton = document.getElementById("switchCamera");

  if (cameraActive) {
    if (videoStream) {
      const tracks = videoStream.getTracks();
      tracks.forEach((track) => track.stop());
    }
    video.srcObject = null;
    videoStream = null;
    cameraActive = false;
    canvasContainer.style.display = "none";
    switchButton.style.display = "none";
    toggleButton.textContent = "Activar Cámara";
  } else {
    try {
      availableDevices = await getVideoDevices();
      currentDeviceIndex = 0;
      await startCamera();

      cameraActive = true;
      canvasContainer.style.display = "block";
      toggleButton.textContent = "Desactivar Cámara";
      // Mostrar solo en móviles y si hay más de una cámara
      const isMobile = window.innerWidth < 1024;
      switchButton.style.display =
        isMobile && availableDevices.length > 1 ? "inline-block" : "none";
    } catch (error) {
      console.error("Error al acceder a la cámara:", error);
      alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }
}

// Capturar imagen desde video
function captureImage() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("captureCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const capturedImage = document.getElementById("capturedImage");
  capturedImage.src = canvas.toDataURL();
  capturedImage.style.display = "block";

  document.getElementById("canvasContainer").style.display = "none";
  document.getElementById("captureOptions").style.display = "block";
}

// Aceptar imagen capturada
function acceptImage() {
  const capturedImage = document.getElementById("capturedImage");

  fetch(capturedImage.src)
    .then((res) => res.blob())
    .then((blob) => {
      // Mostrar miniatura como si fuera archivo subido
      showImageThumbnail(blob);
      processImage(blob);
    });

  resetCaptureState();
  const canvas = document.getElementById("captureCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById("imagePreview").style.display = "none";
  toggleCamera();
}

// Cancelar imagen
function cancelImage() {
  const capturedImage = document.getElementById("capturedImage");
  capturedImage.src = "";
  capturedImage.style.display = "none";

  document.getElementById("captureOptions").style.display = "none";
  document.getElementById("canvasContainer").style.display = "block";

  const canvas = document.getElementById("captureCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Restablecer estado de captura
function resetCaptureState() {
  const capturedImage = document.getElementById("capturedImage");
  capturedImage.src = "";
  capturedImage.style.display = "none";
  document.getElementById("captureOptions").style.display = "none";
}

async function processImage(file) {
  const resized = await resizeImage(file, 1024, 1024);
  const resultDiv = document.getElementById("result");
  const filterToggle = document.getElementById("filterToggle").checked;

  resultDiv.textContent = "Procesando...";
  resultDiv.style.display = "block";

  const formData = new FormData();
  formData.append("image", resized, file.name);
  formData.append("filter", filterToggle);

  try {
    const response = await fetch("http://localhost:5000/ocr", {
      method: "POST",
      body: formData,
      mode: "cors",
    });

    let data;
    const contentType = response.headers.get("content-type");
    try {
      data = contentType?.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      data = await response.text();
    }

    console.log("Texto recibido del servidor:", data);

    if (response.ok) {
      const text = (typeof data === "string" ? data : data.text)?.trim() || "";
      console.log("Texto procesado:", text);

      if (filterToggle) {
        if (text !== "No se encontraron datos de factura.") {
          document.getElementById("editableData").value = text;
          showInvoicePreview();
          resultDiv.textContent = "Datos extraídos correctamente.";
        } else {
          resultDiv.textContent = "No se encontraron datos de factura.";
        }
      } else {
        document.getElementById("editableData").value = text;
        document.getElementById("invoicePreview").style.display = "block";
        document.getElementById("downloadCSVButton").style.display = "none";
        resultDiv.textContent = "Texto completo detectado.";
      }
    } else {
      console.error("Respuesta no exitosa:", data);
      resultDiv.textContent = "Error del servidor al procesar la imagen.";
    }
  } catch (err) {
    console.error("Fetch falló:", err);
    resultDiv.textContent = "Error de red o CORS al procesar la imagen.";
  } finally {
    resetCaptureState();
    document.getElementById("analyzeButton").style.display = "none";
    document.getElementById("clearImageButton").style.display = "none";
    document.getElementById("imagePreview").style.display = "none";
  }
}

// Función auxiliar para capitalizar
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Función para mostrar la vista previa de la factura
function showInvoicePreview() {
  const invoicePreview = document.getElementById("invoicePreview");
  const downloadButton = document.getElementById("downloadCSVButton");

  invoicePreview.style.display = "block";
  downloadButton.style.display = "inline-block";

  // Reemplazamos el manejador anterior (si existiera) y asignamos uno nuevo
  downloadButton.onclick = () => {
    const previewArea = document.getElementById("editableData");
    const csvContent = "data:text/csv;charset=utf-8," + previewArea.value;
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "factura.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

// Función para cambiar el tamaño de la imagen
function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const reader = new FileReader();

    reader.onload = function (e) {
      img.onload = function () {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = Math.round(maxWidth / aspectRatio);
          } else {
            height = maxHeight;
            width = Math.round(maxHeight * aspectRatio);
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, file.type || "image/jpeg");
      };
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
