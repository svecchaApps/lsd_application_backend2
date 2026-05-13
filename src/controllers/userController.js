const mongoose = require("mongoose");
const User = require("../models/userModel");
const Designer = require("../models/designerModel");
const UserStylist = require("../models/stylistUser");
const StylistBooking = require("../models/stylistBooking");
const StylistProfile = require("../models/stylistProfile");
const PaymentDetails = require("../models/paymentDetailsModel");
const { bucket } = require("../service/firebaseServices");
const { admin } = require("../service/firebaseServices");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AUTH_API_URL = "https://indigorhapsodyserver-h9a3.vercel.app/auth/login";
const nodemailer = require("nodemailer");
require("dotenv").config();
const { Twilio } = require("twilio");
const axios = require("axios");
require("dotenv").config();

// Twilio setup
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const otpStorage = new Map();

// Send OTP using Firebase Authentication
exports.requestOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  try {
    // Simulate OTP request using Firebase Admin (Firebase does not expose direct SMS sending via Admin SDK)
    const sessionInfo = await admin.auth().createSessionCookie(phoneNumber, {
      expiresIn: 5 * 60 * 1000, // Expires in 5 minutes
    });

    // Save sessionInfo for later verification
    otpStorage.set(sessionInfo, {
      phoneNumber,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.status(200).json({
      message: "OTP sent successfully",
      sessionInfo,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send OTP", error: error.message });
  }
};

// Verify OTP using Firebase
exports.verifyOtp = async (req, res) => {
  const { sessionInfo, otp } = req.body;

  if (!sessionInfo || !otp) {
    return res
      .status(400)
      .json({ message: "Session Info and OTP are required" });
  }

  try {
    // Check if the session exists
    const storedSession = otpStorage.get(sessionInfo);

    if (!storedSession) {
      return res.status(404).json({ message: "OTP not found or expired" });
    }

    if (storedSession.expiresAt < Date.now()) {
      otpStorage.delete(sessionInfo); // Remove expired session
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Verify OTP using Firebase (Replace with Firebase's actual verification API)
    const verified = otp === "123456"; // Example verification logic (replace with Firebase OTP verification)

    if (verified) {
      otpStorage.delete(sessionInfo); // Remove session after successful verification
      res.status(200).json({ message: "OTP verified successfully" });
    } else {
      res.status(400).json({ message: "Invalid OTP" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to verify OTP", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      email,
      displayName,
      phoneNumber,
      password,
      role,
      is_creator,
      address, // Array of addresses
    } = req.body;

    // Validate that at least email or phoneNumber is provided
    if (!email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Either email or phoneNumber is required to create an account",
      });
    }

    // Validate displayName is provided
    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: "displayName is required",
      });
    }

    // Check if user already exists by email (only if email is provided)
    if (email) {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
      }
    }

    // Check if user already exists by phoneNumber (only if phoneNumber is provided)
    if (phoneNumber) {
      const existingUserByPhone = await User.findOne({ phoneNumber });
      if (existingUserByPhone) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this phone number",
        });
      }
    }

    // Build user object with only provided fields
    const userData = {
      displayName,
      role,
      is_creator,
    };

    // Only include email if provided
    if (email) {
      userData.email = email;
    }

    // Only include phoneNumber if provided
    if (phoneNumber) {
      userData.phoneNumber = phoneNumber;
    }

    // Only include password if provided
    if (password) {
      userData.password = password;
    }

    // Only include address if provided
    if (address && Array.isArray(address)) {
      userData.address = address;
    }

    const newUser = new User(userData);

    // Save the new user to the database
    await newUser.save();

    // Build token payload with only available fields
    const tokenPayload = {
      id: newUser._id,
      role: newUser.role,
      is_creator: newUser.is_creator,
    };

    // Only include email in token if it exists
    if (newUser.email) {
      tokenPayload.email = newUser.email;
    }

    // Only include phoneNumber in token if it exists
    if (newUser.phoneNumber) {
      tokenPayload.phoneNumber = newUser.phoneNumber;
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    // Send welcome email (non-blocking - don't fail user creation if email fails)
//     try {
//       // Set up the email transporter using environment variables
//       const transporter = nodemailer.createTransport({
//         host: process.env.EMAIL_HOST || "smtp.hostinger.com",
//         port: parseInt(process.env.EMAIL_PORT) || 465,
//         secure: true,
//         auth: {
//           user: process.env.EMAIL_USER || "info@indigorhapsody.com",
//           pass: process.env.EMAIL_PASS || "",
//         },
//       });

//       // Email options
//       const mailOptions = {
//         from: `"Indigo Rhapsody" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || "info@indigorhapsody.com"}>`,
//         to: email,
//         subject: "Welcome to Indigo Rhapsody Mobile Application",
//         html: `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8" />
//   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//   <title>Welcome Email</title>
// </head>
// <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
//   <table role="presentation" style="width: 100%; border-collapse: collapse;">
//     <tr>
//       <td style="padding: 0;">
//         <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-collapse: collapse;">

//           <!-- Header -->
//           <tr>
//             <td style="padding: 40px 20px 20px; text-align: center;">
//               <div style="display: inline-block; width: 60px; height: 60px; background-color: #0d47a1; color: white; font-size: 24px; font-weight: bold; line-height: 60px; text-align: center; margin-bottom: 10px;">
//                             <img src="https://firebasestorage.googleapis.com/v0/b/sveccha-11c31.appspot.com/o/Logo.png?alt=media&token=c8b4c22d-8256-4092-8b46-e89e001bd1fe" alt="Welcome illustration" style="max-width: 700px; width: 100%; height: auto; display: block; margin: 0 auto;">

//               </div>
//               <div style="font-size: 12px; color: #666666; letter-spacing: 2px; margin-top: 5px;">
//                 INDIGO RHAPSODY<br>
//                 <span style="font-size: 10px;">MOBILE EXPERIENCE</span>
//               </div>
//             </td>
//           </tr>

//           <!-- Main Content -->
//           <tr>
//             <td style="padding: 20px 40px; text-align: center;">
//               <h2 style="margin: 0 0 10px; font-size: 16px; color: #666666; font-weight: normal; letter-spacing: 1px;">Hello, ${displayName}</h2>
//               <h1 style="margin: 0 0 20px; font-size: 32px; color: #0d47a1; font-weight: bold; line-height: 1.2;">Nice to meet you!</h1>
//               <p style="margin: 0 0 30px; font-size: 16px; color: #666666; line-height: 1.5;">Welcome to Indigo Rhapsody. We are very happy to have you with us.</p>
//               <p style="margin: 0 0 30px; font-size: 18px; color: #0d47a1; font-weight: 500;">Enjoy your journey with Us</p>
//               <a href="https://indigorhapsody.com" style="display: inline-block; background-color: #0d47a1; color: white; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; font-weight: 500; letter-spacing: 1px;">VISIT WEBSITE</a>
//             </td>
//           </tr>

//           <!-- Illustration -->
//           <tr>
//             <td style="padding: 40px 20px; text-align: center;">
//               <img src="https://firebasestorage.googleapis.com/v0/b/popandpose-1ea69.firebasestorage.app/o/images%2FChatGPT%20Image%20Jun%202%2C%202025%2C%2004_18_45%20PM.png?alt=media&token=088a409e-e20a-4900-9012-5ae37c0e5b86" alt="Welcome illustration" style="max-width: 700px; width: 100%; height: auto; display: block; margin: 0 auto;">
//             </td>
//           </tr>

//           <!-- Footer Logo -->
//           <tr>
//             <td style="padding: 40px 20px 20px; text-align: center; border-top: 1px solid #eeeeee;">
//               <div style="display: inline-block; width: 60px; height: 60px; background-color: #0d47a1; color: white; font-size: 24px; font-weight: bold; line-height: 60px; text-align: center; margin-bottom: 20px;">
//                                             <img src="https://firebasestorage.googleapis.com/v0/b/sveccha-11c31.appspot.com/o/Logo.png?alt=media&token=c8b4c22d-8256-4092-8b46-e89e001bd1fe" alt="Welcome illustration" style="max-width: 700px; width: 100%; height: auto; display: block; margin: 0 auto;">

//               </div>
//             </td>
//           </tr>

//           <!-- Social Follow Text -->
//           <tr>
//             <td style="padding: 0 20px 20px; text-align: center;">
//               <p style="margin: 0; font-size: 16px; color: #666666;">Follow us on social platforms to receive updates and exclusive offers</p>
//             </td>
//           </tr>

//           <!-- Social Icons -->
//           <tr>
//             <td style="padding: 0 20px 30px; text-align: center;">
//               <table role="presentation" style="margin: 0 auto; border-collapse: collapse;">
//                 <tr>
//                   <td style="padding: 0 10px;">
//                     <a href="https://www.facebook.com/profile.php?id=61557629035469#" style="display: inline-block; width: 40px; height: 40px; background-color: #0d47a1; border-radius: 50%; text-align: center; line-height: 40px; text-decoration: none;">
//                       <span style="color: white; font-size: 18px;">
//                                              <img src="https://upload.wikimedia.org/wikipedia/commons/c/cd/Facebook_logo_%28square%29.png" alt="Welcome illustration" style="max-width: 700px; width: 100%; height: auto; display: block; margin: 0 auto;">

// </span>
//                     </a>
//                   </td>
//                   <td style="padding: 0 10px;">
//                     <a href="https://www.instagram.com/indigorhapsodyofficial/" style="display: inline-block; width: 40px; height: 40px; background-color: #0d47a1; border-radius: 50%; text-align: center; line-height: 40px; text-decoration: none;">
//                       <span style="color: white; font-size: 18px;">                                                 
//                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/1200px-Instagram_icon.png" alt="Welcome illustration" style="max-width: 700px; width: 100%; height: auto; display: block; margin: 0 auto;">
// </span>
//                     </a>
//                   </td>
                 
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <!-- Navigation Links -->
//           <tr>
//             <td style="padding: 0 20px 30px; text-align: center;">
//               <table role="presentation" style="margin: 0 auto; border-collapse: collapse;">
//                 <tr>
//                   <td style="padding: 0 20px;">
//                     <a href="https://indigorhapsody.com" style="color: #666666; text-decoration: underline; font-size: 14px;">Home</a>
//                   </td>
//                   <td style="padding: 0 20px;">
//                     <a href="https://indigorhapsody.com/contact" style="color: #666666; text-decoration: underline; font-size: 14px;">Contact</a>
//                   </td>
//                   <td style="padding: 0 20px;">
//                     <a href="https://indigorhapsody.com/services" style="color: #666666; text-decoration: underline; font-size: 14px;">Service</a>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>

//           <!-- Footer -->
//           <tr>
//             <td style="background-color: #0d47a1; padding: 30px 20px; text-align: center;">
//               <p style="margin: 0 0 20px; color: #cccccc; font-size: 12px; line-height: 1.5;">
//                 This email was sent to ${email} because you signed up on our app or made a purchase.
//               </p>
             
//               <div style="display: inline-block; background-color: #1565c0; padding: 8px 15px; border-radius: 4px;">
//                 <span style="color: white; font-size: 14px; font-weight: bold;">Indigo Rhapsody</span>
//               </div>
//             </td>
//           </tr>

//         </table>
//       </td>
//     </tr>
//   </table>
// </body>
// </html>
// `,
//     };

//       // Send the welcome email
//       await transporter.sendMail(mailOptions);
//       console.log(`✅ Welcome email sent successfully to ${email}`);
//     } catch (emailError) {
//       // Log email error but don't fail user creation
//       console.error("⚠️ Failed to send welcome email:", emailError.message);
//       console.error("Email error details:", {
//         code: emailError.code,
//         response: emailError.response,
//         email: email,
//       });
//       // Continue with user creation even if email fails
//     }

    // Build response user object with only available fields
    const userResponse = {
      id: newUser._id,
      displayName: newUser.displayName,
      role: newUser.role,
      is_creator: newUser.is_creator,
      createdTime: newUser.createdTime || newUser.createdAt,
    };

    // Only include email in response if it exists
    if (newUser.email) {
      userResponse.email = newUser.email;
    }

    // Only include phoneNumber in response if it exists
    if (newUser.phoneNumber) {
      userResponse.phoneNumber = newUser.phoneNumber;
    }

    // Only include address in response if it exists
    if (newUser.address && newUser.address.length > 0) {
      userResponse.address = newUser.address;
    }

    // Respond with success
    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
      token: `Bearer ${token}`,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.updateUserAddress = async (req, res) => {
  try {
    const { userId } = req.params; // Get userId from request parameters
    const { addressId, nick_name, city, pincode, state, street_details } =
      req.body; // Get address details from request body

    // Check if addressId is provided (to determine if updating an existing address)
    if (addressId) {
      // Update specific address in the array
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, "address._id": addressId }, // Find the user and specific address by its ID
        {
          $set: {
            "address.$.nick_name": nick_name,
            "address.$.city": city,
            "address.$.pincode": pincode,
            "address.$.state": state,
            "address.$.street_details": street_details,
          },
        },
        { new: true } // Return the updated document
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User or address not found" });
      }

      return res
        .status(200)
        .json({ message: "Address updated successfully", user: updatedUser });
    } else {
      // Add a new address to the array
      const updatedUser = await User.findByIdAndUpdate(
        userId, // Find user by ID
        {
          $push: {
            address: {
              nick_name,
              city,
              pincode,
              state,
              street_details,
            },
          },
        },
        { new: true } // Return the updated document
      );

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res
        .status(200)
        .json({ message: "Address added successfully", user: updatedUser });
    }
  } catch (error) {
    console.error("Error updating address:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params; // Extract the user ID from request parameters

    // Find the user by their ID and select only the address field
    const user = await User.findById(userId).select("address");

    // Check if the user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has any addresses
    if (!user.address || user.address.length === 0) {
      return res
        .status(404)
        .json({ message: "No addresses found for this user" });
    }

    // Respond with the list of addresses
    res.status(200).json({
      message: "Addresses fetched successfully",
      addresses: user.address,
    });
  } catch (error) {
    console.error("Error fetching user addresses:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
exports.getUsers = async (req, res) => {
  try {
    const filters = req.query;

    // Sort users by createdTime in descending order (latest first)
    const users = await User.find(filters).sort({ createdTime: -1 });

    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
exports.getTotalUserCount = async (req, res) => {
  try {
    // Count the number of users with the role "User"
    const totalUsers = await User.countDocuments({ role: "User" });

    return res.status(200).json({ totalUsers });
  } catch (error) {
    console.error("Error fetching total user count:", error);
    return res.status(500).json({
      message: "Error fetching total user count",
      error: error.message,
    });
  }
};

exports.getNewUsersByCurrentMonth = async (req, res) => {
  try {
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );

    const newUserCount = await User.countDocuments({
      role: "User",
      createdTime: { $gte: firstDayOfMonth },
    });

    res.status(200).json({ newUserCount });
  } catch (error) {
    console.error("Error fetching new users by month:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Endpoint to get new users count by state (only with role "User")
exports.getUserCountByState = async (req, res) => {
  try {
    const usersByState = await User.aggregate([
      { $match: { role: "User" } }, // Filter for role "User"
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({ usersByState });
  } catch (error) {
    console.error("Error fetching users by state:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Endpoint to get the state with the most users (only with role "User")
exports.getStateWithMostUsers = async (req, res) => {
  try {
    const mostUsersState = await User.aggregate([
      { $match: { role: "User" } }, // Filter for role "User"
      { $group: { _id: "$state", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    if (!mostUsersState.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ mostUsersState: mostUsersState[0] });
  } catch (error) {
    console.error("Error fetching state with most users:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

// Endpoint to get all users with the role "User"
exports.getAllUsersWithRoleUser = async (req, res) => {
  try {
    const users = await User.find({ role: "User" }); // Filter for role "User"

    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching users with role User:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
exports.createUserAndDesigner = async (req, res) => {
  const {
    email,
    password,
    displayName,
    phoneNumber,
    role = "user",
    address = [],
    shortDescription,
    about,
    logoUrl,
    backgroundImageUrl,
  } = req.body;

  // === 1. Validate address early ===
  if (address.length === 0) {
    return res.status(400).json({ success: false, message: "At least one address is required" });
  }

  // === 2. Check for existing user (outside transaction) ===
  const existingUser = await User.findOne({ email }).read('primary'); // or just regular read
  if (existingUser) {
    return res.status(400).json({ success: false, message: "User already exists with this email" });
  }

  // === 3. Create external resources (Firebase, Pickup) BEFORE transaction ===
  try {
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName,
      phoneNumber: phoneNumber.toString(),
    });

    const randomId = Math.floor(100 + Math.random() * 900);
    const pickup_location_name = `${randomId}_${displayName}`;
    const firstAddress = address[0];

    const addPickupResponse = await addPickupLocation({
      pickup_location: pickup_location_name,
      name: displayName,
      email,
      phone: phoneNumber,
      address: firstAddress.street_details,
      address_2: firstAddress.nick_name || "",
      city: firstAddress.city,
      state: firstAddress.state,
      country: "India",
      pin_code: firstAddress.pincode,
    });

    if (!addPickupResponse?.success) {
      await admin.auth().deleteUser(firebaseUser.uid); // cleanup Firebase
      throw new Error("Failed to create pickup location");
    }

    // === 4. NOW start transaction for MongoDB only ===
    const session = await mongoose.startSession({ readPreference: 'primary' });
    session.startTransaction();

    try {
      const newUser = new User({
        email,
        displayName,
        phoneNumber,
        password, // ⚠️ Should be hashed! (security note below)
        role,
        firebaseUid: firebaseUser.uid,
        pickup_location_name,
        address,
      });

      await newUser.save({ session });

      let newDesigner = null;
      if (role === "Designer") {
        newDesigner = new Designer({
          userId: newUser._id,
          logoUrl: logoUrl || null,
          backGroundImage: backgroundImageUrl || null,
          shortDescription,
          about,
          pickup_location_name,
          is_approved: false,
        });
        await newDesigner.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      // === 5. Post-transaction steps ===
      const token = jwt.sign(
        {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          firebaseUid: newUser.firebaseUid,
          ...(newDesigner && { designerId: newDesigner._id }),
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
      );

      await sendWelcomeEmail(email, displayName, token);

      return res.status(201).json({
        success: true,
        message: role === "Designer"
          ? "Designer account created successfully (pending approval)"
          : "User created successfully",
        user: { /* ... */ },
        token: `Bearer ${token}`,
        ...(newDesigner && { designer: { /* ... */ } }),
      });

    } catch (dbError) {
      await session.abortTransaction();
      session.endSession();

      // Cleanup external resources on DB failure
      await admin.auth().deleteUser(firebaseUser.uid);
      // (Optional) Call deletePickupLocation if supported

      throw dbError;
    }

  } catch (error) {
    console.error("Error in user creation:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

// Helper function to send welcome email
async function sendWelcomeEmail(email, displayName, token) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.hostinger.com",
      port: process.env.EMAIL_PORT || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER || "Info@gully2global.com",
        pass: process.env.EMAIL_PASS || "Shasudigi@217",
      },
    });

    const mailOptions = {
      from: `"Indigo Rhapsody" <${process.env.EMAIL_FROM || "Info@gully2global.com"
        }>`,
      to: email,
      subject: "Welcome to Indigo Rhapsody",
      html: generateWelcomeEmail(displayName, token),
    };

    await transporter.sendMail(mailOptions);
  } catch (emailError) {
    console.error("Failed to send welcome email:", emailError);
    // Don't fail the request if email fails
  }
}

// Helper function to generate email HTML
function generateWelcomeEmail(displayName, token) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .token { 
          background-color: #f8f9fa; 
          padding: 10px; 
          margin: 20px 0;
          word-break: break-all;
        }
        .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Welcome to Indigo Rhapsody</h2>
        </div>
        <div class="content">
          <p>Hello ${displayName},</p>
          <p>Thank you for registering with us! Here's your authentication token:</p>
          <div class="token">Bearer ${token}</div>
          <p>Use this token to authenticate your API requests by including it in the Authorization header.</p>
        </div>
        <div class="footer">
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// AddPickupLocation function
const addPickupLocation = async (pickupDetails) => {
  try {
    // Fetch access token
    const authResponse = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "rajatjiedm@gmail.com", // Replace with actual credentials
        password: "Raaxas12#", // Replace with actual credentials
      }),
    });

    const authBody = await authResponse.json();

    if (!authResponse.ok) {
      console.error("Failed to get access token:", authBody);
      throw new Error(authBody.message || "Failed to get access token");
    }

    const authToken = authBody.token;

    // Send request to Shiprocket API
    const response = await fetch(
      "https://apiv2.shiprocket.in/v1/external/settings/company/addpickup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(pickupDetails),
      }
    );

    const responseBody = await response.json();

    if (!response.ok) {
      console.error("Failed to add pickup location:", responseBody);
      throw new Error(responseBody.message || "Failed to add pickup location");
    }

    return responseBody;
  } catch (error) {
    console.error("Error adding pickup location:", error);
    throw error;
  }
};
exports.loginDesigner = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Step 1: Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Step 2: Check if the user's role is "Designer"
    if (user.role !== "Designer") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Not a designer",
      });
    }

    // Step 3: Validate the password (using bcrypt for hashed passwords)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }



    // Step 4: Find the associated designer record
    const designer = await Designer.findOne({ userId: user._id });
    if (!designer) {
      return res.status(404).json({
        success: false,
        message: "Designer profile not found",
      });
    }

    // Step 5: Check if the designer is approved
    if (!designer.is_approved) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your profile is not approved yet.",
      });
    }

    // Step 6: Generate JWT tokens
    const accessTokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      designerId: designer._id,
      is_approved: designer.is_approved,
    };

    const refreshTokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Step 7: Update last login time
    user.last_logged_in = new Date();
    await user.save();

    // Step 8: Return successful response
    res.status(200).json({
      success: true,
      message: "Designer login successful",
      data: {
        userId: user._id,
        designerId: designer._id,
        is_approved: designer.is_approved,
        accessToken: `Bearer ${accessToken}`,
        refreshToken: refreshToken,
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          phoneNumber: user.phoneNumber,
        },
        designer: {
          id: designer._id,
          shortDescription: designer.shortDescription,
          about: designer.about,
          logoUrl: designer.logoUrl,
          backGroundImage: designer.backGroundImage,
          pickup_location_name: designer.pickup_location_name,
        },
      },
    });
  } catch (error) {
    console.error("Error during designer login:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Step 1: Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Step 2: Check if the user's role is "Admin"
    if (user.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Not an admin",
      });
    }

    // Step 3: Validate the password (using bcrypt for hashed passwords)

    // Step 4: Generate JWT token
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    // Step 5: Update last login time
    user.last_logged_in = new Date();
    await user.save();

    // Step 6: Return successful response with token
    res.status(200).json({
      success: true,
      message: "Admin login successful",
      userId: user._id,
      role: user.role,
      token: `Bearer ${token}`,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.checkUserExists = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(200).json({
        success: true,
        message: "User exists",
        userId: user._id,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Check if user has a userStylist account
 * Returns userStylist data if exists, otherwise prompts to create account
 * Uses phoneNumber to identify the user
 */
exports.checkUserStylistAccount = async (req, res) => {
  try {
    // Get phoneNumber from request params or body
    let phoneNumber = null;
    
    // Priority: params > body
    if (req.params.phoneNumber) {
      phoneNumber = req.params.phoneNumber;
    } else if (req.body.phoneNumber) {
      phoneNumber = req.body.phoneNumber;
    } else {
      return res.status(400).json({
        success: false,
        message: "Phone number is required. Please provide phoneNumber in params or body.",
      });
    }

    // Validate phoneNumber
    if (!phoneNumber || phoneNumber.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Phone number cannot be empty",
      });
    }

    // Check if user exists by phoneNumber, if not create one
    let user = await User.findOne({ phoneNumber: phoneNumber });
    if (!user) {
      // Create new user account automatically
      const displayName = req.body.displayName || `User_${phoneNumber.slice(-4)}`;
      const email = req.body.email || null;
      
      user = new User({
        phoneNumber: phoneNumber,
        displayName: displayName,
        email: email,
        role: "User",
      });
      
      await user.save();
    }

    // Check if userStylist account exists
    const userStylist = await UserStylist.findOne({ userId: user._id }).populate('userId', 'displayName email phoneNumber');

    if (userStylist) {
      // User has userStylist account
      return res.status(200).json({
        success: true,
        hasUserStylistAccount: true,
        message: "User has a stylist account",
        data: {
          userStylistId: userStylist._id,
          userId: userStylist.userId._id,
          userInfo: {
            displayName: userStylist.userId.displayName,
            email: userStylist.userId.email,
            phoneNumber: userStylist.userId.phoneNumber,
          },
          stylePreferences: userStylist.style_Preference || [],
          fashionGoals: userStylist.fashion_goals || [],
          bodyType: userStylist.body_type || [],
          sizeInformation: userStylist.size_Information || [],
          colorPreference: userStylist.color_Preference || [],
          budgetRange: userStylist.budget_Range,
          budgetCurrency: userStylist.budget_Currency,
          experimental: userStylist.experimental || [],
          goToOutfit: userStylist.go_to_outfit,
          fashionVibe: userStylist.fashion_vibe,
          userPictures: userStylist.user_Pictures || [],
          createdAt: userStylist.createdAt,
          updatedAt: userStylist.updatedAt,
        },
      });
    } else {
      // User does not have userStylist account
      return res.status(200).json({
        success: true,
        hasUserStylistAccount: false,
        message: "User does not have a stylist account. Please create one to continue.",
        actionRequired: "create_account",
        phoneNumber: phoneNumber,
        userId: user._id,
        userInfo: {
          displayName: user.displayName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        instructions: {
          message: "To create a stylist account, please provide your styling preferences, fashion goals, and other relevant information.",
          endpoint: "/user/create-stylist-account",
          method: "POST",
          requiredFields: [
            "style_Preference",
            "fashion_goals",
            "body_type",
            "size_Information",
            "color_Preference",
            "budget_Range",
            "budget_Currency",
          ],
          optionalFields: [
            "user_Pictures",
            "experimental",
            "go_to_outfit",
            "fashion_vibe",
          ],
        },
      });
    }
  } catch (error) {
    console.error("Error checking userStylist account:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Create a userStylist account for a user
 * Uses phoneNumber to identify the user
 */
exports.createUserStylistAccount = async (req, res) => {
  try {
    // Get phoneNumber from request body
    const phoneNumber = req.body.phoneNumber;
    
    if (!phoneNumber || phoneNumber.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Phone number is required. Please provide phoneNumber in body.",
      });
    }

    // Check if user exists by phoneNumber, if not create one
    let user = await User.findOne({ phoneNumber: phoneNumber });
    if (!user) {
      // Create new user account automatically
      const displayName = req.body.displayName || `User_${phoneNumber.slice(-4)}`;
      const email = req.body.email || null;
      
      user = new User({
        phoneNumber: phoneNumber,
        displayName: displayName,
        email: email,
        role: "User",
      });
      
      await user.save();
    }

    const userId = user._id;

    // Check if userStylist account already exists
    const existingUserStylist = await UserStylist.findOne({ userId: userId });
    if (existingUserStylist) {
      // Same route is used for initial create (basic fields) then full profile save.
      // Merge body into existing doc instead of rejecting — avoids 400 on the second POST.
      const {
        style_Preference,
        fashion_goals,
        body_type,
        size_Information,
        color_Preference,
        budget_Range: bodyBudgetRange,
        budget_Currency: bodyBudgetCurrency,
        experimental,
        go_to_outfit,
        fashion_vibe,
        user_Pictures,
      } = req.body;

      if (Array.isArray(style_Preference)) {
        existingUserStylist.style_Preference = style_Preference;
      }
      if (Array.isArray(fashion_goals)) {
        existingUserStylist.fashion_goals = fashion_goals;
      }
      if (Array.isArray(body_type)) {
        existingUserStylist.body_type = body_type;
      }
      if (Array.isArray(size_Information)) {
        existingUserStylist.size_Information = size_Information;
      }
      if (Array.isArray(color_Preference)) {
        existingUserStylist.color_Preference = color_Preference;
      }
      if (Array.isArray(experimental)) {
        existingUserStylist.experimental = experimental;
      }
      if (Array.isArray(user_Pictures)) {
        existingUserStylist.user_Pictures = user_Pictures;
      }
      if (bodyBudgetRange !== undefined && bodyBudgetRange !== null) {
        existingUserStylist.budget_Range = bodyBudgetRange;
      }
      if (
        bodyBudgetCurrency !== undefined &&
        bodyBudgetCurrency !== null &&
        String(bodyBudgetCurrency).trim() !== ""
      ) {
        existingUserStylist.budget_Currency = bodyBudgetCurrency;
      }
      if (go_to_outfit !== undefined) {
        existingUserStylist.go_to_outfit = go_to_outfit;
      }
      if (fashion_vibe !== undefined) {
        existingUserStylist.fashion_vibe = fashion_vibe;
      }

      existingUserStylist.updatedAt = new Date();
      await existingUserStylist.save();
      await existingUserStylist.populate(
        "userId",
        "displayName email phoneNumber"
      );

      return res.status(200).json({
        success: true,
        message: "User stylist account updated successfully",
        data: {
          userStylistId: existingUserStylist._id,
          userId: existingUserStylist.userId._id,
          userInfo: {
            displayName: existingUserStylist.userId.displayName,
            email: existingUserStylist.userId.email,
            phoneNumber: existingUserStylist.userId.phoneNumber,
          },
          stylePreferences: existingUserStylist.style_Preference,
          fashionGoals: existingUserStylist.fashion_goals,
          bodyType: existingUserStylist.body_type,
          sizeInformation: existingUserStylist.size_Information,
          colorPreference: existingUserStylist.color_Preference,
          budgetRange: existingUserStylist.budget_Range,
          budgetCurrency: existingUserStylist.budget_Currency,
          experimental: existingUserStylist.experimental,
          goToOutfit: existingUserStylist.go_to_outfit,
          fashionVibe: existingUserStylist.fashion_vibe,
          userPictures: existingUserStylist.user_Pictures,
          createdAt: existingUserStylist.createdAt,
          updatedAt: existingUserStylist.updatedAt,
        },
      });
    }

    // Extract data from request body
    const {
      style_Preference = [],
      fashion_goals = [],
      body_type = [],
      size_Information = [],
      color_Preference = [],
      budget_Range,
      budget_Currency,
      experimental = [],
      go_to_outfit,
      fashion_vibe,
      user_Pictures = [],
    } = req.body;

    // Validate required fields
    if (!budget_Range || !budget_Currency) {
      return res.status(400).json({
        success: false,
        message: "budget_Range and budget_Currency are required fields",
      });
    }

    // Create userStylist account
    const userStylist = new UserStylist({
      userId: userId,
      style_Preference: Array.isArray(style_Preference) ? style_Preference : [],
      fashion_goals: Array.isArray(fashion_goals) ? fashion_goals : [],
      body_type: Array.isArray(body_type) ? body_type : [],
      size_Information: Array.isArray(size_Information) ? size_Information : [],
      color_Preference: Array.isArray(color_Preference) ? color_Preference : [],
      budget_Range: budget_Range,
      budget_Currency: budget_Currency,
      experimental: Array.isArray(experimental) ? experimental : [],
      go_to_outfit: go_to_outfit || "",
      fashion_vibe: fashion_vibe || "",
      user_Pictures: Array.isArray(user_Pictures) ? user_Pictures : [],
    });

    await userStylist.save();

    // Populate user details
    await userStylist.populate('userId', 'displayName email phoneNumber');

    return res.status(201).json({
      success: true,
      message: "User stylist account created successfully",
      data: {
        userStylistId: userStylist._id,
        userId: userStylist.userId._id,
        userInfo: {
          displayName: userStylist.userId.displayName,
          email: userStylist.userId.email,
          phoneNumber: userStylist.userId.phoneNumber,
        },
        stylePreferences: userStylist.style_Preference,
        fashionGoals: userStylist.fashion_goals,
        bodyType: userStylist.body_type,
        sizeInformation: userStylist.size_Information,
        colorPreference: userStylist.color_Preference,
        budgetRange: userStylist.budget_Range,
        budgetCurrency: userStylist.budget_Currency,
        experimental: userStylist.experimental,
        goToOutfit: userStylist.go_to_outfit,
        fashionVibe: userStylist.fashion_vibe,
        userPictures: userStylist.user_Pictures,
        createdAt: userStylist.createdAt,
        updatedAt: userStylist.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating userStylist account:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get user profile (for stylist app)
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format"
      });
    }

    // Find user
    const user = await User.findById(userId)
      .select('-password -firebaseUid');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is a stylist
    const stylistProfile = await StylistProfile.findOne({ userId: user._id })
      .select('stylistName stylistImage stylistEmail stylistPhone stylistBio isApproved approvalStatus');

    return res.status(200).json({
      success: true,
      message: "User profile retrieved successfully",
      data: {
        user: {
          _id: user._id,
          displayName: user.displayName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          is_creator: user.is_creator,
          address: user.address,
          recentlyViewedProducts: user.recentlyViewedProducts,
          createdAt: user.createdTime,
          lastLoggedIn: user.last_logged_in
        },
        stylistProfile: stylistProfile || null
      }
    });

  } catch (error) {
    console.error("Get user profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user profile",
      error: error.message
    });
  }
};

// Update user profile (for stylist app)
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { displayName, email, phoneNumber, address } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format"
      });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update fields if provided
    if (displayName !== undefined && displayName !== null) {
      user.displayName = displayName;
    }

    if (email !== undefined && email !== null) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ 
        email: email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email is already taken by another user"
        });
      }
      
      user.email = email;
    }

    if (phoneNumber !== undefined && phoneNumber !== null) {
      // Check if phone number is already taken by another user
      const existingUser = await User.findOne({ 
        phoneNumber: phoneNumber, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number is already taken by another user"
        });
      }
      
      user.phoneNumber = phoneNumber;
    }

    if (address !== undefined && address !== null) {
      // If address is an array, replace it
      if (Array.isArray(address)) {
        user.address = address;
      } else if (typeof address === 'object') {
        // If it's a single address object, add it to the array
        user.address = user.address || [];
        user.address.push(address);
      }
    }

    await user.save();

    // Return updated user data
    const userResponse = {
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      is_creator: user.is_creator,
      address: user.address,
      recentlyViewedProducts: user.recentlyViewedProducts,
      createdAt: user.createdTime,
      lastLoggedIn: user.last_logged_in
    };

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    console.error("Update user profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user profile",
      error: error.message
    });
  }
};

// Get payment history (for both user and stylist roles)
exports.getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, paymentType = 'all' } = req.query;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format"
      });
    }

    // Validate pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number. Must be a positive integer"
      });
    }

    if (isNaN(limitNum) || limitNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit. Must be a positive integer"
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // Check user role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isStylist = user.role === 'Stylist';
    const allPayments = [];

    // Get stylist booking payments (if user is stylist or if paymentType includes bookings)
    if (paymentType === 'all' || paymentType === 'booking') {
      let bookingQuery = {};
      
      if (isStylist) {
        // For stylists, get bookings where they are the stylist
        const stylistProfile = await StylistProfile.findOne({ userId: userId });
        if (stylistProfile) {
          bookingQuery.stylistId = stylistProfile._id;
        }
      } else {
        // For regular users, get their bookings
        bookingQuery.userId = userId;
      }

      // Only get completed payments
      bookingQuery.paymentStatus = { $in: ['completed', 'test'] };

      // Get all bookings first (no pagination yet)
      const bookings = await StylistBooking.find(bookingQuery)
        .populate('userId', 'displayName email phoneNumber')
        .populate('stylistId', 'stylistName stylistEmail stylistPhone')
        .sort({ paymentCompletedAt: -1, createdAt: -1 });

      // Format booking payments
      bookings.forEach(booking => {
        allPayments.push({
          paymentId: booking._id,
          transactionId: booking.razorpayPaymentId || booking.razorpayOrderId,
          type: 'booking',
          amount: booking.paymentAmount,
          currency: booking.paymentCurrency || 'INR',
          paymentMethod: booking.paymentMethod || 'razorpay',
          paymentStatus: booking.paymentStatus,
          status: booking.status,
          description: `Booking: ${booking.bookingTitle}`,
          bookingDetails: {
            bookingId: booking._id,
            bookingIdString: booking.bookingId,
            bookingTitle: booking.bookingTitle,
            bookingType: booking.bookingType,
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            duration: booking.duration
          },
          participant: isStylist ? booking.userId : booking.stylistId,
          createdAt: booking.paymentCompletedAt || booking.createdAt,
          completedAt: booking.paymentCompletedAt
        });
      });
    }

    // Get regular order payments (if paymentType includes orders)
    if (paymentType === 'all' || paymentType === 'order') {
      // Get all order payments first (no pagination yet)
      const orderPayments = await PaymentDetails.find({ userId: userId })
        .populate('cartId', 'total_amount')
        .sort({ completedAt: -1, createdDate: -1 });

      // Format order payments
      orderPayments.forEach(payment => {
        allPayments.push({
          paymentId: payment._id,
          transactionId: payment.transactionId,
          type: 'order',
          amount: payment.amount,
          currency: payment.currency || 'INR',
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          status: payment.status,
          description: payment.description || `Order payment: ${payment.orderId || payment.transactionId}`,
          orderDetails: {
            orderId: payment.orderId,
            paymentReferenceId: payment.paymentReferenceId,
            cartId: payment.cartId?._id,
            totalAmount: payment.cartId?.total_amount
          },
          customerDetails: payment.customerDetails,
          createdAt: payment.createdDate,
          completedAt: payment.completedAt
        });
      });
    }

    // Sort all payments by date (most recent first)
    allPayments.sort((a, b) => {
      const dateA = a.completedAt || a.createdAt;
      const dateB = b.completedAt || b.createdAt;
      return new Date(dateB) - new Date(dateA);
    });

    // Apply pagination to combined results
    const paginatedPayments = allPayments.slice(skip, skip + limitNum);

    // Get total counts
    let totalBookings = 0;
    let totalOrders = 0;

    if (paymentType === 'all' || paymentType === 'booking') {
      let bookingCountQuery = {};
      if (isStylist) {
        const stylistProfile = await StylistProfile.findOne({ userId: userId });
        if (stylistProfile) {
          bookingCountQuery.stylistId = stylistProfile._id;
        }
      } else {
        bookingCountQuery.userId = userId;
      }
      bookingCountQuery.paymentStatus = { $in: ['completed', 'test'] };
      totalBookings = await StylistBooking.countDocuments(bookingCountQuery);
    }

    if (paymentType === 'all' || paymentType === 'order') {
      totalOrders = await PaymentDetails.countDocuments({ userId: userId });
    }

    const totalPayments = totalBookings + totalOrders;

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: {
        payments: paginatedPayments,
        summary: {
          totalPayments,
          totalBookings,
          totalOrders,
          totalAmount: allPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
        },
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalPayments / limitNum),
          totalPayments,
          limit: limitNum,
          hasNextPage: skip + paginatedPayments.length < totalPayments,
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error("Get payment history error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get payment history",
      error: error.message
    });
  }
};

// Convert user to stylist user
exports.convertUserToStylist = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      stylistName,
      stylistEmail,
      stylistPhone,
      stylistAddress,
      stylistCity,
      stylistState,
      stylistPincode,
      stylistCountry,
      stylistImage,
      stylistBio,
      stylistPortfolio,
      stylistExperience,
      stylistEducation,
      stylistSkills,
      stylistAvailability,
      stylistPrice,
      stylistCategories
    } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format"
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is already a stylist
    if (user.role === 'Stylist') {
      const existingStylistProfile = await StylistProfile.findOne({ userId: user._id });
      if (existingStylistProfile) {
        return res.status(400).json({
          success: false,
          message: "User is already a stylist",
          data: {
            user: {
              _id: user._id,
              displayName: user.displayName,
              email: user.email,
              phoneNumber: user.phoneNumber,
              role: user.role
            },
            stylistProfile: existingStylistProfile
          }
        });
      }
    }

    // Check if stylist profile already exists
    const existingProfile = await StylistProfile.findOne({ userId: user._id });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Stylist profile already exists for this user"
      });
    }

    // Validate required fields for stylist profile
    const requiredFields = {
      stylistName: stylistName || user.displayName,
      stylistEmail: stylistEmail || user.email,
      stylistPhone: stylistPhone || user.phoneNumber,
      stylistAddress: stylistAddress || '',
      stylistCity: stylistCity || '',
      stylistState: stylistState || '',
      stylistPincode: stylistPincode || '',
      stylistCountry: stylistCountry || 'India',
      stylistImage: stylistImage || '',
      stylistBio: stylistBio || '',
      stylistPortfolio: stylistPortfolio || [],
      stylistExperience: stylistExperience || '',
      stylistEducation: stylistEducation || '',
      stylistSkills: stylistSkills || [],
      stylistAvailability: stylistAvailability || 'Available'
    };

    // Validate arrays
    if (!Array.isArray(requiredFields.stylistPortfolio)) {
      requiredFields.stylistPortfolio = [];
    }
    if (!Array.isArray(requiredFields.stylistSkills)) {
      requiredFields.stylistSkills = [];
    }

    // Validate categories if provided
    let categoryIds = [];
    if (stylistCategories && Array.isArray(stylistCategories)) {
      for (const catId of stylistCategories) {
        if (mongoose.Types.ObjectId.isValid(catId)) {
          const StylistCategory = require("../models/stylistCategoryModel");
          const category = await StylistCategory.findOne({ 
            _id: catId, 
            isActive: true 
          });
          if (category) {
            categoryIds.push(catId);
          }
        }
      }
    }

    // Update user role to Stylist
    user.role = 'Stylist';
    user.is_creator = true; // Stylists are creators
    await user.save();

    // Create stylist profile
    const stylistProfile = new StylistProfile({
      userId: user._id,
      stylistName: requiredFields.stylistName,
      stylistEmail: requiredFields.stylistEmail,
      stylistPhone: requiredFields.stylistPhone,
      stylistAddress: requiredFields.stylistAddress,
      stylistCity: requiredFields.stylistCity,
      stylistState: requiredFields.stylistState,
      stylistPincode: requiredFields.stylistPincode,
      stylistCountry: requiredFields.stylistCountry,
      stylistImage: requiredFields.stylistImage,
      stylistBio: requiredFields.stylistBio,
      stylistPortfolio: requiredFields.stylistPortfolio,
      stylistExperience: requiredFields.stylistExperience,
      stylistEducation: requiredFields.stylistEducation,
      stylistSkills: requiredFields.stylistSkills,
      stylistCategories: categoryIds,
      stylistAvailability: requiredFields.stylistAvailability,
      stylistPrice: stylistPrice || 0,
      stylistRating: 0,
      stylistReviews: [],
      isApproved: false,
      approvalStatus: "pending",
      applicationStatus: "submitted",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await stylistProfile.save();

    // Populate user details and categories
    await stylistProfile.populate('userId', 'displayName email phoneNumber role');
    if (categoryIds.length > 0) {
      await stylistProfile.populate('stylistCategories', 'name description image icon');
    }

    return res.status(200).json({
      success: true,
      message: "User successfully converted to stylist",
      data: {
        user: {
          _id: user._id,
          displayName: user.displayName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          is_creator: user.is_creator,
          createdAt: user.createdTime
        },
        stylistProfile: stylistProfile
      }
    });

  } catch (error) {
    console.error("Convert user to stylist error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to convert user to stylist",
      error: error.message
    });
  }
};

/**
 * Register / update FCM token for a user
 * POST /user/:userId/fcm-token
 */
exports.registerFcmToken = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fcmToken } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required" });
    }

    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim() === "") {
      return res.status(400).json({ success: false, message: "fcmToken is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken: fcmToken.trim() },
      { new: true }
    ).select("_id displayName email fcmToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "FCM token registered successfully",
      data: { userId: user._id, fcmToken: user.fcmToken },
    });
  } catch (error) {
    console.error("Register FCM token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register FCM token",
      error: error.message,
    });
  }
};

/**
 * Delete user account (soft-delete by removing FCM token and marking inactive,
 * or hard-delete on explicit request)
 * DELETE /user/:userId
 */
exports.deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Cancel any pending/confirmed bookings before deletion
    const StylistBooking = require("../models/stylistBooking");
    await StylistBooking.updateMany(
      { userId, status: { $in: ["pending", "confirmed"] } },
      {
        $set: {
          status: "cancelled",
          isCancelled: true,
          cancellationReason: "Account deleted by user",
          cancelledAt: new Date(),
          cancelledBy: userId,
          updatedAt: new Date(),
        },
      }
    );

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete user account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete account",
      error: error.message,
    });
  }
};

/**
 * Update notification preferences for a user
 * PUT /user/:userId/notification-preferences
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const { bookingConfirmations, sessionReminders, cancellations, promotions, reviews } =
      req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Valid userId is required" });
    }

    const update = {};
    if (bookingConfirmations !== undefined)
      update["notificationPreferences.bookingConfirmations"] = Boolean(bookingConfirmations);
    if (sessionReminders !== undefined)
      update["notificationPreferences.sessionReminders"] = Boolean(sessionReminders);
    if (cancellations !== undefined)
      update["notificationPreferences.cancellations"] = Boolean(cancellations);
    if (promotions !== undefined)
      update["notificationPreferences.promotions"] = Boolean(promotions);
    if (reviews !== undefined)
      update["notificationPreferences.reviews"] = Boolean(reviews);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one preference field is required",
      });
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select(
      "notificationPreferences"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      data: { notificationPreferences: user.notificationPreferences },
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification preferences",
      error: error.message,
    });
  }
};
