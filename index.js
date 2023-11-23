const express = require("express");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5007;

//  <----------Middle ware --------->
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send([{ Massage: "UnAuthorize" }]);
  }

  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send([{ Massage: "UnAuthorize" }]);
    } else {
      req.user = decoded;
      next();
    }
  });
};

//  <-------------------------------MongoDB Server --------------------------->

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_U_NAME}:${process.env.DB_PASS}@cluster0.rsgizg7.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // <--------------------- Collection in database -------------->

    const usersData = client.db("ForumDb").collection("usersInfo");
    // const menusData = client.db("bistroDb").collection("menuItems");
    // const cartData = client.db("bistroDb").collection("carts");
    // const ratingData = client.db("bistroDb").collection("ratings");

    //<------------------Verify Admin----------------->

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.sendingUser;
      const query = { email: email };
      const AdminCK = await usersData.findOne(query);
      if (AdminCK?.role !== "Admin") {
        res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };
    //<------------------JWT For Protection----------------->

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ Success: "Cookies Set Successfully" });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ Cookie: "clear" });
    });
    //<------------------User Info Database----------------->
    app.post("/users", async (req, res) => {
      const cartItems = req.body;
      const query = { email: cartItems.email };
      const exeistUser = await usersData.findOne(query);

      if (exeistUser) {
        return res.send({
          massage: "User Already Exist",
          acknowledged: true,
          insertedId: null,
        });
      }
      const result = await usersData.insertOne(cartItems);
      res.send(result);
    });


    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("I am The API for Bistro Boss Restaurant!");
});

app.listen(port, () => {
  console.log(`Bistro Boss sitting on port ${port}`);
});
