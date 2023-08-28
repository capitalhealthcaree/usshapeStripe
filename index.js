const express = require("express");
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
      return res.json({ error: "No Payment has been made from this email" });
    }
    const matchedEmail = stripeEmail.payment[0].billing_details.name;
    res.status(200).json({
      email: matchedEmail,
      amount: stripeEmail.payment[0].amount / 100,
      mesasge: "Payment received successfully from this email",
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
    const formData = await Rotation.create({
      name,
      email,
      termsConditions,
      reservation,
    });
    // Send an email to the admin
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "webdevelopercapital@gmail.com",
        pass: "uvgqevylpebrtvgj",
      },
    });

    const mailOptions = {
      from: email,
      to: "webdevelopercapital@gmail.com",
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
			<p>Name : ${name}</p>
			<p>Email : ${email}</p>
      <h4> : ${reservation}</h4>
		  </body>
		</html>`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(err);
      } else {
        console.log(info);
      }
    });
    res
      .status(200)
      .json({
        data: formData,
        mesasge: "Your rotation is reserved successfully",
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// app listen
app.listen(process.env.PORT || 4000, () => {
  console.log("Sever is listening on port 4000");
});
