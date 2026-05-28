import mongoose from "mongoose";
import express from "express";
import cors from "cors";

let app =express();

app.use(express.json());
app.use(cors())

mongoose.connect(process.env.MONGO_URL).then(()=>console.log("mongoDb connected")).catch(err=>console.log(err));

let table = new mongoose.Schema({
    username:String, 
    email:String, 
    password:String, 
    sent:[ { to:String, mgs:String } ], 
    receive:[ { from:String, mgs:String } ] 
});


let coll = mongoose.model("mgs",table);

app.get("/mgs",async(req,res)=>{
    let one = await coll.find();
    res.json(one);
})

app.get("/mgs/conversation/:myId/:otherId", async (req, res) => {
    try {
        const me = await coll.findById(req.params.myId);
        const other = await coll.findById(req.params.otherId);

        console.log("me:", me.email);          // ← add this
        console.log("other:", other.email);    // ← add this
        console.log("me.receive:", me.receive); // ← add this

        const sent = me.sent
            .filter(m => m.to === other.email)
            .map(m => ({ from: "me", mgs: m.mgs }));

        const received = me.receive
            .filter(m => m.from === other.email)
            .map(m => ({ from: "them", mgs: m.mgs }));

        console.log("sent:", sent);        // ← add this
        console.log("received:", received); // ← add this

        res.json({ sent, received });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get("/mgs/:id", async(req,res)=>{
    let one = await coll.findById(req.params.id);
    res.json(one);
})

app.post("/mgs",async(req,res)=>{
    let data = new coll(req.body);
    await data.save();
})

app.delete("/mgs/:id",async(req,res)=>{
    await coll.findByIdAndDelete(req.params.id);
})

app.put("/mgs/:id",async(req,res)=>{
    await coll.findByIdAndUpdate(req.params.id);
})

app.put("/mgs", async (req,res)=>{

    try{

        let sender = await coll.findById(req.body.senderId);

        let receiver = await coll.findById(req.body.receiverId);

        sender.sent.push({
            to:req.body.receiverEmail,
            mgs:req.body.message
        });

        receiver.receive.push({
            from:req.body.senderEmail,
            mgs:req.body.message
        });

        await sender.save();
        await receiver.save();

        res.json({
            success:true,
            msg:"message sent"
        });

    }catch(err){

        console.log(err);

        res.status(500).json({
            success:false
        });

    }

});

let PORT = process.env.PORT || 7780;

app.listen(PORT,()=>{
    console.log("Server is Running");
})
