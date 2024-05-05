const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
    },
    mobile:{
        type:Number,
        required:false,
        unique:false,
    },
    password:{
        type:String,
        required:true
    },
    isAdmin:{
        type:Boolean,
        default:false,
    },
},{
    timestamps:true,
});

module.exports = mongoose.model("Users",userSchema);