const express = require("express");
const nodemailer = require("nodemailer");
var nodeoutlook = require("nodejs-nodemailer-outlook");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_TEST);
const bodyParser = require("body-parser");
const cors = require("cors");
const Payment = require("./model/payment");
const Rotation = require("./model/rotation");

app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());

// Database Connection
mongoose.connect(
  "mongodb+srv://ppbackend:Web786786@healthcarecluster.yhawahg.mongodb.net/usshape?retryWrites=true&w=majority"
);
const db = mongoose.connection;
db.on("connected", () => {
  console.log("db connected");
});
db.on("disconnected", (err, res) => {
  console.log("db disconnected", err, "###", res);
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://usshape.org");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

app.get("/", (req, res) => {
  res.send("Stripe Api is working Fine");
});

//....For Stripe.....................

app.post("/payment", async (req, res) => {
  let { amount, token } = req.body;

  try {
    const payment = await stripe.charges.create({
      amount,
      currency: "USD",
      source: token.id,
    });
    // Save the payment to the database
    const payments = new Payment({
      payment: payment,
    });
    await payments.save();

    res.json({
      message: "Payment successful",
      success: true,
    });
  } catch (error) {
    console.log("Error", error);
    res.json({
      message: "Payment failed",
      success: false,
    });
  }
});

// get stripe data by Email
app.get("/getStripe/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const stripeEmail = await Payment.findOne({
      "payment.0.billing_details.name": email,
    });

    if (!stripeEmail) {
      return res.status(400).json({
        message: "No Payment has been made from this email",
      });
    }

    const matchedEmail = stripeEmail.payment[0].billing_details.name;
    const paymentAmount = stripeEmail.payment[0].amount / 100;

    // if (paymentAmount !== 250) {
    //   return res.status(400).json({
    //     message: "Payment amount does not match the expected amount of 250$",
    //   });
    // }

    res.status(200).json({
      email: matchedEmail,
      amount: paymentAmount,
      message: "Payment received successfully from this email",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// for reserve a rotation
app.post("/reserveRotation", async (req, res) => {
  const { name, email, termsConditions, reservation } = req.body;

  try {
    // Check if the email is already in the database
    const existingRotation = await Rotation.findOne({ email });

    if (existingRotation) {
      // Email already reserved
      return res.status(400).json({
        message: "This email is already reserved for a rotation",
      });
    }

    // Generate a unique code with sequential numbers
    function generateUniqueCode(name) {
      // Replace spaces with hyphens and convert to lowercase
      const formattedName = name.replace(/\s/g, "-").toLowerCase();

      // Generate a random number between 10000 and 99999 (5-digit range)
      const random5DigitNumber = Math.floor(Math.random() * 90000) + 10000;

      return `${formattedName}-${random5DigitNumber}`;
    }

    const shareUrl = generateUniqueCode(name);

    // Email not reserved, create the rotation
    const formData = await Rotation.create({
      name,
      email,
      termsConditions,
      reservation,
      url: shareUrl,
    });

    // Send emails to both admin and candidate
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: "contact@usshape.org",
        pass: "786@USshape~",
      },
    });

    const mainUrl = "https://usshape.org/share-externship-form/";
    const completeShareUrl = `${mainUrl}${shareUrl}`;

    const mailOptionsAdmin = {
      from: "contact@usshape.org",
      to: "contact@usshape.org",
      subject: "Externship Alert from USSHAPE",
      html: `
        <html>
          <head>
            <style>
              h1 {
                color: #003062;
              }
              p {
                font-size: 18px;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <h1>Details</h1>
            <a href=${completeShareUrl}>Shareable URL</a>
            <p>Name: ${name}</p>
            <p>Email: ${email}</p>
            <p>Reserved Rotation: ${reservation}</p>
          </body>
        </html>`,
    };

    const mailOptionsCandidate = {
      from: "contact@usshape.org",
      to: email,
      subject: "Reservation Confirmation from USSHAPE",
      html: `
        <html>
          <head>
            <style>
              h1 {
                color: #003062;
              }
              p {
                font-size: 18px;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <h1>Reservation Confirmation</h1>
            <p>Hello ${name},</p>
            <p>Your rotation reservation has been successfully confirmed.</p>
            <p>Reservation: ${reservation}</p>
            <p>Thank you for choosing USSHAPE!</p>
          </body>
        </html>`,
    };

    try {
      await transporter.sendMail(mailOptionsAdmin);
      console.log("Admin confirmation email sent successfully");
    } catch (err) {
      console.error("Error sending admin confirmation email:", err);
      return res.status(500).json({
        message: "Error sending admin confirmation email",
      });
    }

    try {
      await transporter.sendMail(mailOptionsCandidate);
      console.log("User confirmation email sent successfully");
    } catch (err) {
      console.error("Error sending admin confirmation email:", err);
      return res.status(500).json({
        message: "Error sending admin confirmation email",
      });
    }

    res.status(200).json({
      data: formData,
      message: "Your rotation is reserved successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// get reserve a rotations
app.get("/rotation/getAll", async (req, res) => {
  try {
    const data = await Rotation.find();

    if (data) {
      // Extract email addresses from the data and ignore other fields
      const reservationList = data.map((item) => item.reservation);
      res.status(200).json({ reservationList });
    } else {
      res.status(500).json({ err: "Encountered an error while fetching data" });
    }
  } catch (error) {
    res.status(500).json({ err: "An error occurred", error });
  }
});

// get rotations' person data
app.get("/personsrotation/getAll", async (req, res) => {
  try {
    const data = await Rotation.find();

    if (data) {
      res.status(200).json({ data: data });
    } else {
      res.status(500).json({ err: "Encountered an error while fetching data" });
    }
  } catch (error) {
    res.status(500).json({ err: "An error occurred", error });
  }
});

// get externship Application Form By Url
app.get("/personsrotation/getByName", async (req, res) => {
  try {
    const slug = req.query.url;
    const form = await Rotation.findOne({ url: slug });
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    res.status(200).json({ data: form });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// app listen
app.listen(process.env.PORT || 4000, () => {
  console.log("Sever is listening on port 4000");
});
