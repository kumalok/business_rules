const express = require('serverless-express/express');
const cors = require('cors');
const router = express();
const isHullTypeAV = require("./module/isHullTypeAV");

router.post("/", cors(), (req, res) => {
    var { hullTypeCd } = req.body;
    res.json(isHullTypeAV(hullTypeCd));
});

module.exports = router;
