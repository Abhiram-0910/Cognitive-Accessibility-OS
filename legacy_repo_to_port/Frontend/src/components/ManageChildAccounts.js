import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/ManageChildAccounts.css";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from './Logout_bar';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const ManageChildAccounts = () => {
  const username = localStorage.getItem("username");
  console.log("Username : " + username);
  const [childAccounts, setChildAccounts] = useState([]);
  const [newChild, setNewChild] = useState({ name: "", age: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(""); // For success messages
  const [errorMessage, setErrorMessage] = useState(""); // For error messages
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Fetch child accounts
  useEffect(() => {
    const fetchChildAccounts = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/admin/verified/${username}`);
        setChildAccounts(response.data.children_accounts || []);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch child accounts.");
        setLoading(false);
      }
    };
    fetchChildAccounts();
  }, []);

  // Handle form changes
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setNewChild((prev) => ({ ...prev, [id]: value }));
  };

  // Create a new child account
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    // Clear previous messages
    setSuccessMessage("");
    setErrorMessage("");

    if (!newChild.name || !newChild.age || !newChild.password) {
      setErrorMessage("All fields are required.");
      return;
    }

    try {
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/admin/add-child/${username}`, newChild);
      setChildAccounts(response.data); // Update the child accounts list
      setNewChild({ name: "", age: "", password: "" }); // Reset form
      setSuccessMessage("Child account created successfully!");
    } catch (err) {
      console.error("Failed to create child account:", err.message);
      setErrorMessage("Failed to create child account. Please try again.");
    }
  };

  const handleLogout = () => {
    console.log(`${username} logged out.`);
    navigate("/", { state: { username } }); // Redirect to the home or login page
  };

  // Render
  return (
    <div className="manage-child-accounts">
      <Navbar username={username} handleLogout={handleLogout} role="admin" />
      <div className="create-child-block">
        <h2>Create New Child Account</h2>
        <form className="create-child-form" onSubmit={handleCreateAccount}>
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              value={newChild.name}
              onChange={handleInputChange}
              placeholder="Enter child name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="age">Age:</label>
            <input
              type="number"
              id="age"
              value={newChild.age}
              onChange={handleInputChange}
              placeholder="Enter child age"
            />
          </div>
          <div className="form-group" style={{ position: "relative" }}>
            <label htmlFor="password">Password:</label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={newChild.password}
              onChange={handleInputChange}
              placeholder="Enter child password"
              style={{ paddingRight: "30px" }}
            />
            <span
              className="eye-icon"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                cursor: "pointer",
                position: "absolute",
                right: "10px",
                top: "70%",
                transform: "translateY(-50%)",
              }}
            >
              <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} />
            </span>
          </div>
          {successMessage && (
            <p style={{ color: "green", marginTop: "5px", fontSize: "0.9em" }}>
              {successMessage}
            </p>
          )}
          {errorMessage && (
            <p style={{ color: "red", marginTop: "5px", fontSize: "0.9em" }}>
              {errorMessage}
            </p>
          )}
          <button type="submit" className="create-btn">
            Create Account
          </button>
        </form>
      </div>

      <div className="child-accounts-block">
        <h2>Existing Child Accounts</h2>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : childAccounts.length > 0 ? (
          <ul>
            {childAccounts.map((child, index) => (
              <li key={index} className="child-account">
                <span>
                  <strong>Name:</strong> {child.name} | <strong>Age:</strong> {child.age}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No child accounts available.</p>
        )}
      </div>
    </div>
  );
};

export default ManageChildAccounts;
