// src/components/ProtectedRoute.js
// import React from 'react';
// import { Navigate } from 'react-router-dom';
// import { verifyToken } from '../utils/auth'; // Import verifyToken from utils

// const ProtectedRoute = ({ children, requiredRole }) => {
//   const token = localStorage.getItem('token'); // Get the token from local storage
//   const user = JSON.parse(localStorage.getItem('user')); // Get the user info from localStorage
//   if (!token || !user) {
//     return <Navigate to="/unauthorized" />; // If no token or user info, redirect to unauthorized page
//   }
//   const decoded = verifyToken(token); // Decode and validate the token

//   if (!decoded || user.role !== requiredRole) {
//     return <Navigate to="/unauthorized" />; // Redirect to AccessDenied component
//   }

//   return children; // Render the child components if authorized
// };

// export default ProtectedRoute;

// src/components/ProtectedRoute.js

// import React, { useState, useEffect } from "react";
// import { Navigate } from "react-router-dom";
// import axios from "axios";

// const ProtectedRoute = ({ allowedRoles, children }) => {
//   const token = localStorage.getItem("token");
//   const role = localStorage.getItem("role");
//   const [isValid, setIsValid] = useState(false);

//   useEffect(() => {
//     if (token) {
//       axios
//         .get('auth/validate-token', { headers: { Authorization: `Bearer ${token}` } })
//         .then(() => setIsValid(true))
//         .catch(() => {
//           localStorage.removeItem("token");
//           localStorage.removeItem("role");
//           setIsValid(false);
//         });
//     }
//   }, [token]);

//   if (!token || !isValid) {
//     return <Navigate to="/" replace />;
//   }

//   if (!allowedRoles.includes(role)) {
//     return <Navigate to="/unauthorized" replace />;
//   }

//   return children;
// };

// export default ProtectedRoute;
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const [isValid, setIsValid] = useState(true); // Assume the token is valid initially

  useEffect(() => {
    // No need to verify the token on the frontend
    if (!token) {
      setIsValid(false); // Token is not available
    }
  }, [token]);

  if (!token || !isValid) {
    return <Navigate to="/" replace />; // Redirect to login if no token
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />; // Redirect to unauthorized if role doesn't match
  }

  return children; // Render the protected route if the token and role are valid
};

export default ProtectedRoute;
