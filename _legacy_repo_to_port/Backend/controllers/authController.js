const nodemailer = require("nodemailer");
const crypto = require("crypto");
const AdminDetails = require("../models/adminModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// Register a new Admin
const register = async (req, res) => {
  try {
    // const { username, password, role, isVerified } = req.body;
    const {
      admin_name,
      phone_number,
      admin_email,
      admin_profession,
    } = req.body;

    console.log(
      "Admin_name: " +
        admin_name +
        "phone_number: " +
        phone_number +
        "admin_email: " +
        admin_email +
        "admin_profession: " +
        admin_profession 
    );

    if (!admin_name || !phone_number || !admin_email || !admin_profession) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newAdmin = new AdminDetails({
      admin_name: admin_name,
      phone_number: phone_number,
      admin_email: admin_email,
      admin_profession: admin_profession,
    });
    await newAdmin.save();

    res.status(201).json({
      message:
        "Your form is submitted successfully Response will be sent to your mail soon ",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering admin.", error: error.message });
  }
};

const login = async (req, res) => {
  console.log("Login attempt:", req.body);

  const { username, password } = req.body;
  const admin_email = username;

  try {
    // Debugging: Log the admin_email
    console.log("admin_email in query:", admin_email);

    // Step 1: Check if the user is an admin
    const adminUser = await AdminDetails.findOne({ admin_email });
    console.log("Step 1 - User lookup result:", adminUser);

    if (adminUser) {
      // Step 2: Validate password for admin
      const isMatch = await bcrypt.compare(password, adminUser.password);
      console.log("Step 2 - Password match result:", isMatch);

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid password" });
      }

      // Step 3: Generate JWT and redirect
      const token = jwt.sign(
        { id: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      console.log("Step 3 - JWT generated:", token);

      const redirectTo =
        adminUser.role === "admin"
          ? "/analysis"
          : adminUser.role === "super_admin"
          ? "/super-admin-dashboard"
          : "/";
      console.log("Step 4 - Redirecting to:", redirectTo);

      return res.status(200).json({
        token,
        user: {
          id: adminUser._id,
          role: adminUser.role, // Send role along with the token
          email: adminUser.email,
          // any other relevant information you want to send
        },
        message: `Welcome, ${adminUser.role}!`,
        redirectTo,
      });
    }

    // Step 5: Check if user is a child account
    const parentAccount = await AdminDetails.findOne({
      "children_accounts.name": username,
    });
    console.log("Step 5 - Parent account lookup result:", parentAccount);

    if (!parentAccount || !parentAccount.children_accounts.length) {
      return res.status(401).json({ message: "Invalid username or account" });
    }

    // Step 6: Match child account
    const childAccount = parentAccount.children_accounts.find(
      (child) => child.name === username
    );
    console.log("Step 6 - Found child account:", childAccount);

    if (!childAccount) {
      return res.status(401).json({ message: "Child account not found" });
    }
   
    // Step 7: Directly compare the password for child account (plaintext comparison)
    if (password !== childAccount.password) {
      return res.status(401).json({ message: "Invalid password" });
    }
    console.log("Step 7 - Password match for child account");

    // Step 8: Generate JWT for child
    const childToken = jwt.sign(
      { id: childAccount._id, role: "child" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("Step 8 - JWT for child account generated:", childToken);

    return res.status(200).json({
      token: childToken,
      message: `Welcome, ${childAccount.name}!`,
      user:{
        role:"child"
      },
      redirectTo: "/select-game",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


const updateAdminStatus = async(req,res)=>{
  try {
    const { id } = req.params;
    const { status } = req.body; // "Approved" or "Rejected"
    console.log("id: ",id,"Status: ",status);
    // Validate status value
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    
    const admin = await AdminDetails.findByIdAndUpdate(id, { status }, { new: true });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }
    
       // If admin is approved, generate random password and send email
       if (status === "Approved") {
        const randomPassword = crypto.randomBytes(8).toString('hex'); // Generate random password
        const hashedPassword = await bcrypt.hash(randomPassword, 10); // Hash the password
  
        // Update the admin's password with the new hashed password
        admin.password = hashedPassword;
        await admin.save();
  
        // Prepare the email content
        const subject = "Your Account Has Been Approved!";
        const html = `<h3>Welcome, ${admin.admin_name}!</h3>
                      <p>Your account has been approved. Here are your credentials:</p>
                      <p>Email: ${admin.admin_email}</p>
                      <p>Password: ${randomPassword}</p>`;
  
        // Send email with credentials
        await sendEmail(admin.admin_email, subject, null, html);
      }

    res.status(200).json({ message: `Admin status updated to ${status}.`, admin });
  } catch (error) {
    res.status(500).json({ message: "Error updating status.", error: error.message });
  }
};


const updatePassword = async (req, res) => {
  try {
    const { id } = req.params; // Get admin ID from URL
    const { password } = req.body; // Get new password from request body

    // Validate input
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the admin's password in the database
    const updatedAdmin = await AdminDetails.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { new: true } // Return the updated document
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    res.status(200).json({
      message: "Password updated successfully.",
      admin: { id: updatedAdmin._id, admin_name: updatedAdmin.admin_name },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const getObjectID = async (req,res)=>
{
  const {admin_email} =req.params;
    console.log("Username is : ", admin_email);
  try{
    
    const objId = await AdminDetails.findOne({admin_email});
    console.log("inside the route :",objId);
    res.status(200).json({
      message: "object id found",
      admin: { id: objId._id},
    });
    return objId._id;
  }catch(error)
  {
    res.status(500).json({ message:"go ree ",error:error.message});
  }
};



// Setup Nodemailer transporter (using Gmail for example)
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email provider
  host: 'smtp.gmail.com',
  port: 587, // or 587 for TLS
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,  // Your email address
    pass: process.env.EMAIL_PASS,  // Your email password (use .env for security)
  },
  logger: true, // Enable logging for debugging
  debug: true,  // Enable SMTP debugging
});
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Transport Error:", error); // Debugging SMTP issues
  } else {
    console.log("SMTP Transport Verified: Ready to send emails");
  }
});
// Send email function
const sendEmail = async (to, subject, text, html) => {
  const mailOptions = {
    from: {
      name : "Joy with Learning",
      address:process.env.EMAIL_USER
    },
    to: to,
    subject: subject,
    text: text,
    html: html,
  };
  console.log("Preparing to send email..."); // Log before sending
  try {
    const info=await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response); // Log success response
    console.log("Message ID:", info.messageId); // Log Message ID for reference
  } catch (error) {
    console.error("Error sending email:", error); // Log error details
    console.error("Error Code:", error.code); // Log specific error code
    console.error("Response from Server:", error.response); // Log server response
    console.error("Failed Command:", error.command); // Log failed command if applicable
  }
};

const getAllStatus = async (req,res)=>
{
  console.log("Finding all the status from adminSchema...");
  const admin_info = await AdminDetails.find();
  console.log(admin_info);
  res.status(200).json({
    admin_info});

}




module.exports = {
  register,
  login,
  updateAdminStatus,
  updatePassword,
  getAllStatus,
  getObjectID
};
