  import mongoose from "mongoose";

  const ComplaintSchema = new mongoose.Schema(
    {
      raisedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Who raised the complaint
        required: true,
      },        
      againstUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // If complaint is against a customer
      },
      againstRestaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant", // If complaint is against a restaurant
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order", // Related order
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      complaintStatus: {
        type: String,
        enum: ["Customer", "Restaurant"], // Who raised it
        required: true,
      }, 
      status: {
        type: String,
        enum: ["Pending", "Reviewing", "Resolved"],
        default: "Pending",
      },

      // Action taken by complaint manager
      managerAction: {
        type: String,
        enum: ["Warned", "Blocked", "Active", "None"],
        default: "None",
      },

      // Messages sent by complaint manager
      responseToCustomer: {
        type: String,
        default: "",
      },
      responseToRestaurant: {
        type: String,
        default: "",
      },

      // Which manager handled the complaint
      handledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
    { timestamps: true }
  );

  const Complaint = mongoose.model("Complaint", ComplaintSchema);
  export default Complaint;



