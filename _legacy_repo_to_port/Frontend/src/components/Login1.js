import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Login1.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const LoginAndRegister = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between SignUp and Login
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    admin_name: "",
    phone_number: "",
    admin_email: "",
    admin_profession: "therapist",
  });

  const [message, setMessage] = useState(""); // Success message
  const [error, setError] = useState(""); // Error message
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility

  const handleToggle = () => setIsSignUp(!isSignUp); // Toggle views

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const { username, password } = formData;
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/auth/adminlogin`, {
        username,
        password,
      });

      const { message, token, user, redirectTo } = response.data;
      setMessage(message);
      setError("");


      if (token) {
        localStorage.setItem("username", username);
        localStorage.setItem("token", token);
        localStorage.setItem("role", user.role);
        navigate(redirectTo || "/");
      }
    } catch (error) {
      setError("Login failed. Please try again.");
      setMessage("");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    try {
      setMessage("");
      setError("");

      const { admin_name, phone_number, admin_email, admin_profession } = formData;
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/auth/register`, {
        admin_name,
        phone_number,
        admin_email,
        admin_profession,
      });

      if (response.data.success) {
        setMessage(response.data.message);
        setError(""); 
      } else {
        setError(response.data.message);
        
      }
    } catch (error) {
      setError("Registration failed. Please try again.");
      setMessage("");
    }
  };

  return (
    <div className={`container ${isSignUp ? "sign-up-mode" : ""}`}>
      <div className="forms-container">
        <div className="signin-signup">
          {/* Login Form */}
          {!isSignUp && (
            <form onSubmit={handleLoginSubmit} className="sign-in-form">
              <h2 className="title">Login</h2>
              {message && <p className="success-message">{message}</p>}
              {error && <p className="error-message">{error}</p>}

              <div className="input-field">
                <input
                  type="text"
                  placeholder="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="input-field">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="eye-icon lower-eye-icon"
                >
                  <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} />
                </span>
              </div>
              <button type="submit" className="btn">Login</button>
              <p>
                Don't have an account?{" "}
                <span onClick={handleToggle} className="toggle-link highlight-link">
                  Register now
                </span>
              </p>
            </form>
          )}

          {/* Register Form */}
          {isSignUp && (
            <form onSubmit={handleRegisterSubmit} className="sign-up-form">
              <h2 className="title">Register</h2>
              {/* Render messages */}
{/* Render messages with inline styles */}
<div>
        {error || message}
      </div>

              <div className="input-field">
                <input
                  type="text"
                  placeholder="Admin Name"
                  name="admin_name"
                  value={formData.admin_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="input-field">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="input-field">
                <input
                  type="email"
                  placeholder="Email"
                  name="admin_email"
                  value={formData.admin_email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="input-field">
                <select
                  name="admin_profession"
                  value={formData.admin_profession}
                  onChange={handleInputChange}
                  required
                >
                  <option value="therapist">Therapist</option>
                  <option value="game_developer">Game Developer</option>
                </select>
              </div>
              <button type="submit" className="btn">Register</button>
              <p>
                Already have an account?{" "}
                <span onClick={handleToggle} className="toggle-link highlight-link">
                  Login here
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginAndRegister;
