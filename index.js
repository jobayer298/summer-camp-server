require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());




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
    const userCollection = client.db("summerCamp").collection("users")

    //save users to db
    app.get("/users", async(req, res) =>{
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    app.put("/users/:email" , async(req, res) =>{
      const email = req.params.email
      const user = req.body
      const query = {email: email}
      const options = {upsert: true}
      const updateDoc = {
        $set : user 
      }
      const result = await userCollection.updateOne(query, updateDoc, options)
      console.log(result);
      res.send(result)
    })
    //make admin 

    app.patch("/users/admin/:id", async(req, res) =>{
      const id = req.params.id 
      const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      }
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

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