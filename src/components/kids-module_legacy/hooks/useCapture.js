import { useRef } from "react";
import { supabase } from "../../../lib/supabase";
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

      const fileName = `${newSessionId}/${Date.now()}-capture.png`;
      
      console.log("[useCapture] Uploading to Supabase:", fileName);
      
      supabase.storage
        .from('kids_sessions')
        .upload(fileName, blob, { contentType: 'image/png' })
        .then(({ data, error }) => {
          if (error) {
            console.error("[useCapture] Image upload error:", error);
            return;
          }
          console.log("[useCapture] Image uploaded:", data);
        });
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

        const fileName = `${newSessionId}/${Date.now()}-screenshot.png`;
        
        supabase.storage
          .from('kids_sessions')
          .upload(fileName, blob, { contentType: 'image/png' })
          .then(({ data, error }) => {
            if (error) {
              console.error("[useCapture] Screenshot upload error:", error);
              return;
            }
            console.log("[useCapture] Screenshot uploaded:", data);
          });
      });
    });
  };

  return { canvasRef, captureImage, captureScreenshot };
};

export default useCapture;
