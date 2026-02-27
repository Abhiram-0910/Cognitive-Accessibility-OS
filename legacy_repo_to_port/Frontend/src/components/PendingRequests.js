import { useEffect, useState } from "react";
import React from "react";
import axios from "axios";
import "../styles/PendingRequests.css";

const PendingRequests = () => {
  const [admins, setAdmins] = useState([]);

  // Fetch admin data
  useEffect(() => {
    const getAdminStatus = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/auth/getAllStatus`
        );
        const filteredAdmins = response.data.admin_info?.filter(
          (admin) => admin.admin_email !== "superadmin@example.com"
        ) || [];
  
        setAdmins(filteredAdmins || []);
        
      } catch (error) {
        console.log("Failed to fetch details: ", error);
      }
    };
    getAdminStatus();
  }, []);

  // Handle approval action
  const handleApproval = async (adminId) => {
    const req_body = { status: "Approved" };
    try {
      await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/auth/updateAdminStatus/${adminId}`,
        req_body
      );
      setAdmins((prevAdmins) =>
        prevAdmins.map((admin) =>
          admin._id === adminId ? { ...admin, status: "Approved" } : admin
        )
      );
    } catch (error) {
      console.log("Failed to approve admin: ", error);
    }
  };

  return (
    <div className="mt-5">
      <h1 className="text-center mb-4">Pending Admin Requests</h1>
      <p className="text-center text-muted">
        Manage all pending admin requests below.
      </p>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="thead-dark">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col" className="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin._id}>
                <td>{admin.admin_name}</td>
                <td>{admin.admin_email}</td>
                <td className="text-center">
                  <button
                    className={`btn ${
                      admin.status === "Approved" ? "btn-success" : "btn-danger"
                    }`}
                    disabled={admin.status === "Approved"}
                    onClick={() => handleApproval(admin._id)}
                  >
                    {admin.status === "Approved" ? "Approved" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PendingRequests;
