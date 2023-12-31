const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;



// Middleware
app.use(cors({
    origin: [
        // 'http://localhost:5173', 'http://localhost:5174'
        'https://car-doctor-eb798.web.app',
        'https://car-doctor-eb798.firebaseapp.com/?_gl=1*1atic40*_ga*MTc4MzU2NDg3Mi4xNjk4NTE2NDk2*_ga_CW55HF8NVT*MTY5ODczNzE0My4yLjEuMTY5ODczNzMzNC4xOS4wLjA.'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


// console.log(process.env.DB_USER);
// console.log(process.env.DB_PASS);

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // Import ObjectId
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.il0t7ji.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares                                                                           
const logger = async (req, res, next) => {
    console.log('log: info', req.method, req.url);
    // console.log('called:', req.host, req.originalUrl)
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('value of the token in middlewire', token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        console.log('decoded', decoded)
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        await client.connect();

        const serviceCollection = client.db('cardoctor').collection('services');
        const bookingCollection = client.db('cardoctor').collection('booking');


        // auth related api
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            console.log('user for token', user);

            // const token = jwt.sign(user, 'secret', { expiresIn: '1h' });

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
            // res.send(token);
        })

        // Services related API
        app.get('/services', logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) } // Corrected typo here

            const options = {
                // Include only the `title` and `price` fields in the returned document
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };

            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        });



        //booking
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });
        //get
        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            // console.log('tt token', req.cookies.token)
            console.log('user in the valid token', req.user)
            if (req.query.email !== req.user.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })
        //delete bokkings
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })
        //update
        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            // console.log(updatedBooking);
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensure that the client will close when you finish/error
        // await client.close();
    }
}

run().catch(console.error);

app.get('/', (req, res) => {
    res.send('Doctor is running');
});

app.listen(port, () => {
    console.log(`Car Doctor Server is running on port ${port}`);
});
