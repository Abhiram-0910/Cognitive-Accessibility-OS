import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/UpdatePassword.css";
import Navbar from './Logout_bar';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const UpdatePassword = () => {
  const username = localStorage.getItem("username");
  if (!username) {
    console.error("Username not found in localStorage.");
  }
  const admin_email = username || ""; // Define admin_email inside the component

  const [objId, setObjId] = useState(null); // State to store Object ID
  const [password, setPassword] = useState(""); // State to store new password
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility
  const [successMessage, setSuccessMessage] = useState(""); // State for success message
  const [errorMessage, setErrorMessage] = useState(""); // State for error message

  // Fetch Object ID
  useEffect(() => {
    const fetchObjID = async () => {
      try {
        if (!process.env.REACT_APP_BACKEND_URL) {
          console.error("Backend URL is not set. Check your .env file.");
          return;
        }

        console.log("Fetching Object ID for admin_email:", admin_email);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/auth/getObjectID/${admin_email}`
        );
        console.log("Object ID response:", response.data);
        setObjId(response.data.admin.id); // Save Object ID in state
      } catch (err) {
        console.error("Failed to fetch object ID:", err.message);
      }
    };

    if (admin_email) {
      fetchObjID();
    } else {
      console.error("Admin email is not defined.");
    }
  }, [admin_email]);

  // Handle form submission
  const handleUpdatePassword = async (e) => {
    e.preventDefault(); // Prevent form from refreshing the page

    // Reset messages
    setSuccessMessage("");
    setErrorMessage("");

    if (!password) {
      setErrorMessage("Password is required."); // Set error message
      return;
    }

    if (!objId) {
      setErrorMessage("Object ID not found. Cannot update password."); // Set error message
      return;
    }

    try {
      const response = await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/auth/updatePassword/${objId}`,
        { password }
      );
      console.log("Password update response:", response.data);
      setSuccessMessage("Your password has been successfully updated!"); // Set success message
    } catch (err) {
      console.error("Failed to update password:", err.message);
      setErrorMessage("Error updating password. Please try again."); // Set error message
    }
  };

  // Define userNameWithoutNumbers and handleLogout
  const userNameOnly = username ? username.split('@')[0] : "User"; 
  const userNameWithoutNumbers = userNameOnly.replace(/[0-9]/g, ''); // Example of removing numbers from username
  const handleLogout = () => {
    localStorage.removeItem("username");
  };

  return (
    <div>
      <Navbar username={userNameWithoutNumbers} handleLogout={handleLogout} role="admin" />
      <div className="update">
        <div className="create-child-block">
          <h2>Update Password</h2>
          <form className="create-child-form" onSubmit={handleUpdatePassword}>
            <div className="form-group">
              <label htmlFor="password">New Password:</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: "30px", flex: 1 }}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    cursor: "pointer",
                    fontSize: "1.2em",
                    userSelect: "none",
                  }}
                >
                  {showPassword ? (
                    <FontAwesomeIcon icon={faEye} />
                  ) : (
                    <FontAwesomeIcon icon={faEyeSlash} />
                  )}
                </span>
              </div>
              {successMessage && ( // Render success message below input
                <p style={{ color: "green", marginTop: "5px", fontSize: "0.9em" }}>
                  {successMessage}
                </p>
              )}
              {errorMessage && ( // Render error message below input
                <p style={{ color: "red", marginTop: "5px", fontSize: "0.9em" }}>
                  {errorMessage}
                </p>
              )}
            </div>
            <button type="submit" className="create-btn">
              Change Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;
