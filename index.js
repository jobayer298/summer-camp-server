require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
  res.json("summer school is running");
});

app.listen(port, (req, res) => {
  console.log(`server is running on port ${port}`);
});