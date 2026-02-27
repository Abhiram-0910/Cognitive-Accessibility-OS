import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
// this hook creates a unique sessionn id and returns it 
const useSessionId = () => {
  const [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const newSessionId = uuidv4();
    // uuidv4 is the funcitionn that geenrates a unique id 
    setSessionId(newSessionId);
    console.log(newSessionId);
  }, []);

  return { sessionId };
};

export default useSessionId;
