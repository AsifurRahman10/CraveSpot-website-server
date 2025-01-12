const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require("jsonwebtoken");
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.Payment_secret);


app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_PASS}@cluster0.y6uow.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    tls: true,
    serverSelectionTimeoutMS: 3000,
    autoSelectFamily: false,
});

async function run() {
    try {

        const menuCollection = client.db('CraveSpotDB').collection('menu')
        const reviewCollection = client.db('CraveSpotDB').collection('reviews')
        const cartCollection = client.db('CraveSpotDB').collection('cart')
        const userCollection = client.db('CraveSpotDB').collection("users")
        const paymentCollection = client.db('CraveSpotDB').collection('payment')

        // middleware for verify token
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "Forbidden access" })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "Forbidden access" })
                }
                req.decoded = decoded;
                // next
                next();
            })
        }

        // middleware for checking is admin or not
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user.role === "admin";
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        // create the token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
            res.send({ token });
        })

        // payment related api
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(price, amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        // save payment history to database
        app.post('/paymentHistory', async (req, res) => {
            const data = req.body;
            const paymentHistoryResult = await paymentCollection.insertOne(data);
            // res.send(paymentHistoryResult)
            // delete old data
            const query = {
                _id: {
                    $in: data.cartIds.map(id => new ObjectId(id))
                }
            }
            const deleteCartData = await cartCollection.deleteMany(query);
            res.send(deleteCartData)
        })

        // get all the menu item
        app.get('/menu', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 0;
            const category = req.query.category;

            const query = category ? { category } : {};
            // if query available
            const skip = page * limit;

            // if (limit === 0) {
            //     const result = await menuCollection.find().toArray();
            //     return res.send(result);
            // }
            const result = await menuCollection.find(query).skip(skip).limit(limit).toArray();
            res.send(result);
        })

        // post a menu item
        app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
            const menu = req.body;
            const result = await menuCollection.insertOne(menu);
            res.send(result);
        })

        // delete a menu
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result)
        })

        // update a menu
        app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateItem = {
                $set: {
                    name: data.name,
                    recipe: data.recipe,
                    category: data.category,
                    category: data.category,
                    price: data.price,
                    image: data.image
                }
            }
            const result = await menuCollection.updateOne(filter, updateItem);
            res.send(result);
        })

        // get a single menu
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.findOne(query);
            res.send(result);
        })

        // product count

        app.get("/menuCount", async (req, res) => {
            const category = req.query.category;
            const query = category ? { category } : {};
            const count = await menuCollection.countDocuments(query);
            res.send({ count })
        })

        // get all the review
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        // write user add to cart data 
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        })

        // get all the cart data 
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // delete a cart data
        app.delete("/carts/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // save user info while login
        app.post('/user', async (req, res) => {
            const userData = req.body;
            const email = userData.email;
            const query = { email: email };
            const isAlreadyExist = await userCollection.findOne(query);
            if (isAlreadyExist) {
                return res.send({ message: "user already exist", insertedId: null })
            }
            const result = await userCollection.insertOne(userData);
            res.send(result);
        })

        // get all the user from database
        app.get('/user', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);
        })
        // delete a user from data base
        app.delete('/user/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // make a user admin 
        app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedUser = {
                $set: {
                    role: 'admin',
                }
            }
            const result = await userCollection.updateOne(filter, updatedUser);
            res.send(result);
        })

        // get payment history of user
        app.get('/paymentHistory/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(401).send({ message: "Unauthorized access." });
            }
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // check is the user is admin or not
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(401).send({ message: "unauthorize access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const admin = user.role === 'admin';
            res.send({ admin });
        })


        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Server is running');
})

app.listen(port, () => {
    console.log("server is running on", port);
})