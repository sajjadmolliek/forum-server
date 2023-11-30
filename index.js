const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5007;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

//  <----------Middle ware --------->
app.use(
  cors({
    origin: [
      "https://forum-b8cea.firebaseapp.com",
      "https://forum-b8cea.web.app",
      "http://localhost:5173",
    ],

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
    const AboutUserData = client.db("ForumDb").collection("aboutUser");
    const postsData = client.db("ForumDb").collection("postsInfo");
    const commentsData = client.db("ForumDb").collection("comments");
    const announcementsData = client.db("ForumDb").collection("announcements");
    const TagsData = client.db("ForumDb").collection("Tags");
    const ReportsData = client.db("ForumDb").collection("Reports");

    //<------------------Verify Admin----------------->

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.sendingUser;
      const query = { email: email };
      const AdminCK = await usersData.findOne(query);
      try {
        if (AdminCK?.role !== "Admin") {
          res.status(403).send({ message: "Forbidden Access" });
        }
      } catch {
        console.log("sorry");
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
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        // .cookie("token", token, {
        //   httpOnly: true,
        //   // secure: process.env.NODE_ENV === "production" ? true : false,
        //   // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        // })
        .send({ Success: "Cookies Set Successfully" });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ Cookie: "clear" });
    });
    //<------------------Payments Info Database----------------->

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //<------------------AboutUser Info Database----------------->

    app.patch("/aboutUser", verifyToken, async (req, res) => {
      const aboutUser = req.body;
      const filter = { email: aboutUser.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: aboutUser.name,
          email: aboutUser.email,
          aboutEmail: aboutUser.aboutEmail,
          phone: aboutUser.phone,
          address: aboutUser.address,
        },
      };
      const result = await AboutUserData.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    app.get("/aboutUser", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await AboutUserData.findOne({ email });
      res.send(result);
    });
    //<------------------Comments Posts Into Database----------------->

    app.post("/comment", verifyToken, async (req, res) => {
      const post = req.body;
      const result = await commentsData.insertOne(post);
      res.send(result);
    });
    app.get("/comment", verifyToken, async (req, res) => {
      const result = await commentsData.find().toArray();
      res.send(result);
    });
    app.get("/comments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { commentId: id };
      const result = await commentsData.find(query).toArray();
      res.send(result);
    });

    //<------------------Announcement Given Into Database----------------->

    app.post("/announcement", verifyToken, async (req, res) => {
      const announcement = req.body;
      const result = await announcementsData.insertOne(announcement);
      const updateHoiche = await usersData.updateMany(
        {},
        { $inc: { notifications: 1 } }
      );
      res.send(result);
    });
    app.get("/announcement", verifyToken, async (req, res) => {
      const result = await announcementsData.find().toArray();
      res.send(result);
    });
    //<------------------Announcement Given Into Database----------------->

    app.post("/report", verifyToken, async (req, res) => {
      const report = req.body;
      const result = await ReportsData.insertOne(report);
      res.send(result);
    });
    app.get("/reports", verifyToken, async (req, res) => {
      const result = await ReportsData.find().toArray();
      res.send(result);
    });
    //<------------------Tags Given Into Database----------------->

    app.post("/tags", async (req, res) => {
      const tags = req.body;
      const result = await TagsData.insertOne(tags);
      res.send(result);
    });
    app.get("/tags", async (req, res) => {
      const result = await TagsData.find().toArray();
      res.send(result);
    });

    //<------------------ Posts_data Info Database----------------->

    app.post("/posts", verifyToken, async (req, res) => {
      const post = req.body;
      post.postedTime = new Date();
      const result = await postsData.insertOne(post);
      res.send(result);
    });
    app.get("/totalPosts", verifyToken, async (req, res) => {
      const result = await postsData.find().toArray();
      res.send(result);
    });
    app.get("/sort/upvote", async (req, res) => {
      const page = req.query.page - 1;
      const skip = 10 * page;
      const result = await postsData
        .aggregate([
          {
            $addFields: {
              downVote: {
                $subtract: ["$upVote", "$downVote"],
              },
            },
          },
          {
            $sort: { downVote: -1 },
          },
        ])
        .skip(skip)
        .limit(10)
        .toArray();
      res.send(result);
    });
    app.get("/sort/downvote", async (req, res) => {
      const page = req.query.page - 1;
      const skip = 10 * page;

      const result = await postsData
        .aggregate([
          {
            $addFields: {
              downVote: {
                $subtract: ["$upVote", "$downVote"],
              },
            },
          },
          {
            $sort: { downVote: 1 },
          },
        ])
        .skip(skip)
        .limit(10)
        .toArray();
      res.send(result);
    });
    app.get("/posts/allPost", async (req, res) => {
      const search = req.query.search;
      const page = req.query.page - 1;
      const skip = 10 * page;
      const regex = new RegExp(search, "i");
      const query = { tag: regex };
      if (search === "all") {

        const result = await postsData
          .find()
          .skip(skip)
          .limit(10)
          .sort({ postedTime: -1 })
          .toArray();
          const dataLength = await postsData.estimatedDocumentCount();
          res.send({ result, dataLength });
        } else {
          const result = await postsData
          .find(query)
          .skip(skip)
          .limit(10)
          .sort({ postedTime: -1 })
          .toArray();
        const dataLength = await postsData.estimatedDocumentCount();
        res.send({ result, dataLength });
      }
    });
    app.get("/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsData.findOne(query);
      res.send(result);
    });
    app.patch("/details/:id", async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      const filter = { _id: new ObjectId(id) };
      const upVote = req.body.upVote;
      const query = { likesId: email };
      const result = await postsData?.findOne(filter);
      const get = result.likesId?.find((re) => re === email);

      if (get === undefined) {
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            upVote: upVote + 1,
            likesId: [email],
          },
        };
        const result = await postsData.updateOne(filter, updateDoc, options);
        res.send(result);
      } else {
        res.send("Sorry");
      }
    });
    app.patch("/disLike/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const downVote = req.body.downVote;
      const email = req.body.email;

      const query = { disLikesId: email };
      const result = await postsData?.findOne(filter);
      const getDisLike = result.disLikesId?.find((re) => re === email);
      const getLike = result.likesId?.find((re) => re === email);

      if (getLike) {
        const result = await postsData?.deleteOne(filter);
      }

      // if (getDisLike === undefined) {
      //   const filter = { _id: new ObjectId(id) };
      //   const options = { upsert: true };
      //   const updateDoc = {
      //     $set: {
      //       downVote: downVote + 1,
      //       disLikesId: [email],
      //     },
      //   };
      //   const result = await postsData.updateOne(filter, updateDoc, options);
      //   res.send(result);
      // } else {
      //   res.send("Sorry");
      // }
    });
    app.get("/posts/timeline", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await postsData
        .find(query)
        .sort({ postedTime: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/posts/myPosts", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await postsData.find(query).toArray();
      res.send(result);
    });
    app.get("/posts/limit", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const exeistUser = await usersData.findOne(query);

      if (exeistUser?.membership !== "bronze") {
        const premiumUser = true;
        res.send({ premiumUser });
      } else {
        const result = await postsData.countDocuments(query);

        if (result < 5) {
          const premiumUser = true;
          res.send({ premiumUser });
        } else {
          const premiumUser = false;
          res.send({ premiumUser });
        }
      }
    });
    app.delete("/deletePost/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postsData.deleteOne(query);
      res.send(result);
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
    app.get("/notification", async (req, res) => {
      const email = req.query.email;
      query = { email: email };
      const result = await usersData.findOne({ email });
      res.send(result);
    });
    app.patch("/patchNotification", async (req, res) => {
      const email = req.query.email;
      filter = { email: email };
      const result = await usersData.findOne({ email });

      if (result) {
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            notifications: 0,
          },
        };

        const result = await usersData.updateOne(filter, updateDoc, options);
        res.send(result);
      }
    });
    app.get("/users/admin", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await usersData.findOne({ email });
      if (result) {
        res.send(result);
      } else {
        res
          .status(404)
          .send({ message: "User not found for the provided email." });
      }
    });
    app.get("/users/manage", verifyToken, async (req, res) => {
      const searchQuery = req.query.uName;
      const regex = new RegExp(searchQuery, "i");
      if (searchQuery === "all") {
        const result = await usersData.find().toArray();
        res.send(result);
      } else {
        const result = await usersData.find({ name: regex }).toArray();
        res.send(result);
      }
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email === req.user.sendingUser) {
        const query = { email: email };
        const result = await usersData.findOne(query);
        let admin = false;

        if (result.role === "Admin") {
          admin = true;

          res.send({ admin });
        }
      } else {
        res.status(403).send([{ Massage: "Forbidden Access", status: 403 }]);
      }
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            role: "Admin",
          },
        };
        const result = await usersData.updateOne(filter, updateDoc, options);
        res.send(result);
      }
    );
    app.patch("/users/membership/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          membership: "gold",
        },
      };

      const result = await usersData.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    app.patch("/membershipCancel/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          membership: "bronze",
        },
      };
      const result = await usersData.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersData.deleteOne(query);
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
  res.send("ChiChat is Chatting!");
});

app.listen(port, () => {
  console.log(`ChiChat is Chatting on port ${port}`);
});
