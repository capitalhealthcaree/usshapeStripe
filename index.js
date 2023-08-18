const express = require("express");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_TEST);
const bodyParser = require("body-parser");
const cors = require("cors");
const Payment = require("./model/payment");

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

//  ....................................End-Points...............................
app.post("/payment", cors(), async (req, res) => {
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

    res.json({
      message: "Payment successful",
      success: true,
    });

    await payments.save();
  } catch (error) {
    console.log("Error", error);
    res.json({
      message: "Payment failed",
      success: false,
    });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log("Sever is listening on port 4000");
});
