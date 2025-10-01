import express from "express";
import Property from "../models/Room.js";

const router = express.Router();

// Get all properties
router.get("/", async (req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a property
router.post("/", async (req, res) => {
  const property = new Property({
    name: req.body.name,
    address: req.body.address,
    type: req.body.type,
    bedrooms: req.body.bedrooms,
    bathrooms: req.body.bathrooms,
    rentAmount: req.body.rentAmount,
    features: req.body.features,
    description: req.body.description,
  });

  try {
    const newProperty = await property.save();
    res.status(201).json(newProperty);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Make sure to export the router
export default router;
