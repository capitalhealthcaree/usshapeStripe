const express = require("express");
const nodemailer = require("nodemailer");
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

    // Email not reserved, create the rotation
    const formData = await Rotation.create({
      name,
      email,
      termsConditions,
      reservation,
    });

    // Send emails to both admin and candidate
    const transporter = nodemailer.createTransport("SMTP", {
      service: "hotmail",
      auth: {
        user: "contact@usshape.org",
        pass: "786@USshape~",
      },
    });

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
            <p>Name: ${name}</p>
            <p>Email: ${email}</p>
            <p>Reservation: ${reservation}</p>
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

    transporter.sendMail(mailOptionsAdmin, (err, info) => {
      if (err) {
        console.error(err);
      } else {
        console.log(info);
      }
    });

    transporter.sendMail(mailOptionsCandidate, (err, info) => {
      if (err) {
        console.error(err);
      } else {
        console.log(info);
      }
    });
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

// app listen
app.listen(process.env.PORT || 4000, () => {
  console.log("Sever is listening on port 4000");
});
