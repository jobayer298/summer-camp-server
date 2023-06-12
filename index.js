require("dotenv").config();
const express = require("express");
var jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log({ authorization });
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.je2pvxf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("summerCamp").collection("users");
    const classCollection = client.db("summerCamp").collection("classes");
    const selectedClassCollection = client
      .db("summerCamp")
      .collection("selectedClass");
    const paymentCollection = client.db("summerCamp").collection("payment");

    //verify admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //jwt

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //checking admin

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    // api for instructors
    app.get("/instructors", async (req, res) => {
      const result = await userCollection.find({ role: "teacher" }).limit(6).toArray();
      res.send(result);
    });

    //checking teacher
    app.get("/users/teacher/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ teacher: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { teacher: user?.role === "teacher" };
      res.send(result);
    });

    //save users to db
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //save classes to db
    app.post("/classes", async (req, res) => {
      const classes = req.body;
      const result = await classCollection.insertOne(classes);
      res.send(result);
    });
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.get("/teacherClasses", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      // const decodedEmail = req.decoded.email;
      // if (email !== decodedEmail) {
      //   return res
      //     .status(403)
      //     .send({ error: true, message: "forbidden access" });
      // }
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    //save selected class
    app.post("/selectedClasses", async (req, res) => {
      const classes = req.body;
      const result = await selectedClassCollection.insertOne(classes);
      res.send(result);
    });
    //popular class
    app.get("/popularClasses", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ totalEnrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/selectedClasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/selectedClasses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      // console.log(result);
      res.send(result);
    });
    //make admin

    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //class approved api
    app.patch("/users/class/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //class denied api
    app.patch("/users/class/deny/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied",
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //send feedback

    app.put("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = req.body;
      console.log(updateDoc);
      const classes = {
        $set: {
          feedback: updateDoc.feedback,
        },
      };
      const result = await classCollection.updateOne(query, classes);
      res.send(result);
    });

    //update class info
    app.patch("/updateClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = req.body;
      console.log(updateDoc);
      const classes = {
        $set: {
          className: updateDoc.className,
          seat: updateDoc.seat,
          totalEnrolled: updateDoc.totalEnrolled,
        },
      };
      const result = await classCollection.updateOne(query, classes);
      res.send(result);
    });
    //singleclass api 
     app.get("/singleClass/:id", async (req, res) => {
       const id = req.params.id;
       const query = { _id: new ObjectId(id) };
       const result = await classCollection.findOne(query);
       res.json(result);
     });


    //make teacher
    app.patch("/users/teacher/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "teacher",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //payment intent

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      console.log(price);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const cartID = payment.cartID;
      const classId = payment.classID;
      const result = await paymentCollection.insertOne(payment);
      const query = {
        _id: new ObjectId(cartID),
      };
      const courseFilter = {
        _id: new ObjectId(classId),
      };
      const seat = payment.seat - 1;
      const totalEnrolled = payment.totalEnrolled + 1;
      const updateDoc = {
        $set: { seat, totalEnrolled },
      };
      const updateResult = await classCollection.updateOne(
        courseFilter,
        updateDoc
      );
      const deleteResult = await selectedClassCollection.deleteOne(query);
      res.send({ result, deleteResult, updateResult });
    });
    app.get("/enrolledClass", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });
    app.get("/history", async (req, res) => {
      const result = await paymentCollection
        .find()
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    //stats 

    app.get("/admin-stats", async(req, res) =>{
       const users = await userCollection.estimatedDocumentCount()
       const totalClasses = await classCollection.estimatedDocumentCount()
       const order = await paymentCollection.estimatedDocumentCount()
       res.send({
        users, totalClasses, order
       })
    })

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("summer school is running");
});

app.listen(port, (req, res) => {
  console.log(`server is running on port ${port}`);
});
