const mongoose = require("mongoose");
//const ChildAccountSchema = require("./childModel").schema;

const AdminSchema = new mongoose.Schema({
  admin_name: { type: String, required: true },
  phone_number: { type: String, required: true },
  admin_email: { type: String, required: true, unique: true },
  role: { type: String, default: "admin" },
  admin_profession: {
    type: String,
    enum: ["therapist", "game_developer"],
    required: true,
  },
  password: { type: String, default : null}, // Make sure to hash this later
  status: { type: String, default: "Pending" }, 
  children_accounts: [{
    name: { type: String, required: true },
    age: { type: Number, required: true },
    password: { type: String, required: true },
    _id: false // Disable the automatic _id for subdocuments
  }], 
});

const AdminDetails = mongoose.model("AdminSchema", AdminSchema);

module.exports = AdminDetails;
