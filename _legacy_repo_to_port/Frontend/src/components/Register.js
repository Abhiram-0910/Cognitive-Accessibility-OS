import React, { useState } from "react";
import axios from "axios"; // For making HTTP requests
import "../styles/Register.css";

const Register = () => {
  const [formData, setFormData] = useState({
    admin_name: "",
    phone_number: "",
    admin_email: "",
    admin_profession: "therapist", // Default value
  });

  const [message, setMessage] = useState(""); // To display success or error messages
  const [error, setError] = useState(""); // To display error messages

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
     
    try {
      console.log(formData);
      const response = await axios.post("http://localhost:5000/auth/register", formData); // Replace with your backend URL
      setMessage(response.data.message);
      setError("");
    } catch (error) {
      setMessage("");
      setError(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="registration-container">
      <form onSubmit={handleSubmit} className="registration-form">
        {/* Success or Error Message */}
        {message && <div className="alert alert-success text-center">{message}</div>}
        {error && <div className="alert alert-danger text-center">{error}</div>}

        <h2 className="text-center mb-4">Admin Registration</h2>

        <div className="input-field">
          <label htmlFor="admin_name" className="form-label">Admin Name</label>
          <input
            type="text"
            className="form-control"
            id="admin_name"
            name="admin_name"
            value={formData.admin_name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-field">
          <label htmlFor="phone_number" className="form-label">Phone Number</label>
          <input
            type="tel"
            className="form-control"
            id="phone_number"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-field">
          <label htmlFor="admin_email" className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            id="admin_email"
            name="admin_email"
            value={formData.admin_email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-field">
          <label htmlFor="admin_profession" className="form-label">Admin Role</label>
          <select
            className="form-select"
            id="admin_profession"
            name="admin_profession"
            value={formData.admin_profession}
            onChange={handleChange}
            required
          >
            <option value="therapist">Therapist</option>
            <option value="game_developer">Game Developer</option>
          </select>
        </div>

        <button type="submit" className="btn btn-primary w-100" style={{ textTransform: "none" }}>
          Submit
        </button>
      </form>
    </div>
  );
};

export default Register;
