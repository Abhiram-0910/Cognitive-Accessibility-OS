const jwt = require('jsonwebtoken');

const authenticateToken=(req, res, next) =>{

    const authHeader=req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Token missing or invalid" });
      }
    const token=authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
      req.user = decoded; // Attach payload to request
      next(); // Proceed to the next middleware/route
    }catch (err) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });//If the token is missing or invalid, it returns a 401 Unauthorized or 403 Forbidden response, respectively.
   }
}

module.exports = authenticateToken;