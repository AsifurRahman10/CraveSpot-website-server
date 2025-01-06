const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion } = require('mongodb');
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
        // get all the menu item
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        // get all the review
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
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