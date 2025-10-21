import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
  {
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // who raised the complaint
      required: true,
    },
    againstUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // user being complained against (optional)
    },
    againstRestaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant", // restaurant being complained against (optional)
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Complaint = mongoose.model("Complaint", ComplaintSchema);
export default Complaint;
