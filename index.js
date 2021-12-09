const express = require('express')
var cors = require('cors')
const { MongoClient } = require('mongodb');
require('dotenv').config()


const admin = require("firebase-admin");

const app = express()
const port = process.env.PORT || 5000;
const fileUpload = require('express-fileupload');
const ObjectID = require('mongodb').ObjectId;

const serviceAccount = require('./jerins-parlours-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hg2sj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch {

    }

  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("jerins-parlour");
    const servicesCollection = database.collection("services");
    const bookingCollection = database.collection("booking");
    const reviewCollection = database.collection("review");
    const userCollection = database.collection("users");

    // add services post
    app.post('/services', async (req, res) => {
      const title = req.body.title;
      const description = req.body.description;
      const price = req.body.price;
      const pic = req.files.img;
      const picData = pic.data;
      const encodedPic = picData.toString('base64');
      const imageBuffer = Buffer.from(encodedPic, 'base64');
      const services = {
        title,
        description,
        price,
        image: imageBuffer
      };
      const result = await servicesCollection.insertOne(services);
      res.json(result);
    });


    
    // delete single service
    app.delete('/deleteServices/:id', async (req, res) => {
      const result = await servicesCollection.deleteOne({ _id: ObjectID(req.params.id) })
      res.json(result);
      console.log(result);
    })

    // get services
    app.get('/services', async (req, res) => {
      const result = await servicesCollection.find({}).toArray();
      res.json(result);
    });

    app.get('/services/:id', async (req, res) => {
      const result = await servicesCollection.find({ _id: ObjectID(req.params.id) }).toArray()
      res.json(result);
    });

    //add bookings
    app.post('/booking', async (req, res) => {
      const result = await bookingCollection.insertOne(req.body);
      res.json(result);
    });

    // get bookings
    app.get('/bookings', async (req, res) => {
      const result = await bookingCollection.find({ email: req.query.email }).toArray();
      res.json(result);
    })

    // get all booking
    app.get('/allBooking', async (req, res) => {
      const result = await bookingCollection.find({}).toArray();
      res.json(result)
    });


    // update booking status
    app.put('/booking/:id', async (req, res) => {
      const filter = { _id: ObjectID(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: req.body.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    })

    // delete single booking
    app.delete('/deleteBooking/:id', async (req, res) => {
      const result = await bookingCollection.deleteOne({ _id: ObjectID(req.params.id) });
      res.json(result);
    });

    // add review
    app.post('/addReview', async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      res.json(result);
    });

    ////////////////////////Save user to database////////////////////////

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });

    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userCollection.findOne({ email: requester });
        if (requesterAccount.role === 'admin') {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: 'admin' } };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else {
        res.status(403).json({ message: 'you do not have access to make admin' })
      }

    })
  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
