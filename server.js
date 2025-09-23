import express from "express";
import dotenv from 'dotenv'
import { connectToMongo } from "./config/db.js";
import userRouter from "./routes/userRoutes.js";
import restaurantRouter from "./routes/restaurantRoutes.js";
import adminRouter from "./routes/adminRoutes.js"
import orderRouter from "./routes/orderRoutes.js"

dotenv.config({ override: true,debug:true });

connectToMongo()
const app = express()
app.use(express.json())

app.get('/',(req,res)=>{
    res.send("FoodGo is running...")
})

app.use('/api/user',userRouter)
app.use('/api/restaurant',restaurantRouter)
app.use('/api/admin',adminRouter)
app.use('/api/order',orderRouter)

const port = process.env.PORT || 3000
app.listen(port,()=>{
    console.log(`Server started on port ${port}`)
})