const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
// Define a schema for user authentication
const authSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ["admin", "child"] },
  isVerified: { type: Boolean, default: false }, // True only after admin approval
});

// Hash the password before saving
// authSchema.pre('save', async function (next) {
//     if (this.isModified('password')) {
//       this.password = await bcrypt.hash(this.password, 10);
//     }
//     next();
//  });

const UserAuth = mongoose.model("UserAuth", authSchema);

module.exports = UserAuth;
