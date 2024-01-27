const express = require('serverless-express/express');
const cors = require('cors');
const router = express();
const calculateAirFare = require("./module/calculateAirFare");

router.post("/", cors(), (req, res) => {
    var { departureCity, arrivalCity } = req.body;
    res.json(calculateAirFare(departureCity, arrivalCity));
});

module.exports = router;
