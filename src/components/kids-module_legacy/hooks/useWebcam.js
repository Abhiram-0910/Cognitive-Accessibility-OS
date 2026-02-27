import { useState, useRef } from "react";
// this hook is to ask for webcame access 
const useWebcam = () => {
  const videoRef = useRef(null);
  const [webcamGranted, setWebcamGranted] = useState(false);
  const requestWebcamAccess = () => {
    
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        console.log("camera access given");
        videoRef.current.srcObject = stream;
        setWebcamGranted(true);
      })
      .catch((err) => {
        console.error("Error accessing webcam:", err);
        setWebcamGranted(false);
      });
  };

  return { videoRef, webcamGranted, requestWebcamAccess };
};

export default useWebcam;
