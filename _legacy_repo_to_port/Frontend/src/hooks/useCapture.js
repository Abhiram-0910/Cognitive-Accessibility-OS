import { useRef } from "react";
import axios from "axios";
import html2canvas from "html2canvas";

const useCapture = (videoRef) => {
  const canvasRef = useRef(null);

  // Function to capture images from the video
  const captureImage = (newSessionId, sessionName, gameName) => {
    console.log("Capture image function called");
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!canvas) {
      console.error("Canvas is not available.");
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      console.error("Canvas context is not available.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("Failed to create Blob from canvas.");
        return;
      }

      const formData = new FormData();
      formData.append("image", blob, "capture.png");
      formData.append("newSessionId", newSessionId);
      formData.append("sessionName", sessionName);
      formData.append("gameName", gameName);

      console.log("In useCapture:", newSessionId, sessionName, gameName);
      axios
        .post("http://localhost:5000/child/uploads", formData)
        .then((response) => console.log("Image uploaded:", response.data))
        .catch((error) => console.error("Error uploading image:", error));
    });
  };

  // Function to capture screenshots of the DOM
  const captureScreenshot = (newSessionId, sessionName, gameName) => {
    console.log("Capture screenshot function called");
    html2canvas(document.body).then((screenshotCanvas) => {
      screenshotCanvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to create Blob from screenshot.");
          return;
        }

        const formData = new FormData();
        formData.append("screenshot", blob, "screenshot.png");
        formData.append("newSessionId", newSessionId);
        formData.append("sessionName", sessionName);
        formData.append("gameName", gameName);

        axios
          .post("http://localhost:5000/child/screenshots", formData)
          .then((response) => console.log("Screenshot uploaded:", response.data))
          .catch((error) => console.error("Error uploading screenshot:", error));
      });
    });
  };

  return { canvasRef, captureImage, captureScreenshot };
};

export default useCapture;
