require('dotenv').config();
const userService = require("../services/user_service");
const { comparePassword } = require('../utils/password_util');
const { verifyRefreshToken, generateTokenPair } = require('../utils/jwt_util');
const phoneService = require("../services/phone_service");
const redisService = require('../services/redis_service');

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

const signIn = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).send({ message: "Username and password are required" });
    }
    try {
        const user = await userService.getUserByUsername(username);

        if (!user) {
            res.status(404).send({ message: "User not found" });
        }

        const isPasswordValid = await comparePassword(password, user.password);

        if (isPasswordValid) {
            const otp = generateOTP();
            await redisService.setOtpByUsername(username, otp);
            await phoneService.sendOTP(user.phone_number, otp);
            console.log(`otp: ${otp}`);
            res.status(200).send();
        } else {
            res.status(401).send({ error: "invalid_password" });
        }
    } catch (err) {
        console.error("Sign In Error: ", err.message);
        res.status(500).send({ error: "Internal Server Error" });
    }
};

const signUp = async (req, res) => {
    try {
        const userDto = await userService.createUser(req.body);
        res.status(201).send(userDto);
    } catch (err) {
        if (err.message === "user_exists") {
            res.status(409).send({ error: "User exists" });
        }
        else {
            console.error("Sign Up Error: ", err.message);
            res.status(500).send({ message: "Internal Server Error" });
        }
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { username, otp } = req.body;

        const savedOTP = await redisService.getOtpByUsername(username);
        const user = await userService.getUserByUsername(username);

        if (!savedOTP) {
            res.status(400).send({ error: "2fa_expired" });
        }

        if (!user){
            res.status(404).send({ error: "user_not_found" });
        }

        if (otp === savedOTP) {
            await redisService.deleteOtpByUsername(username);
            const { authToken, refreshToken } = await generateTokenPair(user.user_id);
            await redisService.setRefreshTokenByUserId(user.user_id, refreshToken);
            res.cookie('refresh', refreshToken, {
                httpOnly: true,
                sameSite: 'Strict',
                maxAge: 60 * 24 * 60 * 60 * 1000,
            });
            res.status(200).send({ auth: authToken });
        }
        else {
            res.status(401).send({ error: "invalid_2fa_code" });
        }
    } catch (err) {
        console.error("Verifying OTP Error: ", err.message);
        res.status(500).send({ error: "Internal Server Error" });
    }
}

const refresh = async (req, res) => {
    try {
        const { refresh } = req.cookies;
        
        if (!refresh) {
            return res.status(401).json({ error: 'refresh_token_needed' });
        }

        const tokenData = await verifyRefreshToken(refresh).data;
        
        const user_id = tokenData.user_id;
        const savedRefresh = await redisService.getRefreshTokenByUserId(user_id);
        
        if (refresh === savedRefresh) {
            const { authToken, refreshToken } = await generateTokenPair(user_id);
            await redisService.setRefreshTokenByUserId(user_id, refreshToken);
            
            res.cookie('refresh', refreshToken, {
                httpOnly: true,
                sameSite: 'Strict',
                maxAge: 60 * 24 * 60 * 60 * 1000,
            });
            
            res.status(200).send({ auth: authToken });
        }
    } catch (err) {
        if(err.name === "TokenExpiredError"){
            res.status(401).send({ error: "refresh_expired" });
        }
        else if(err.name === "JsonWebTokenError"){
            res.status(400).send({ error: "invalid_refresh" });
        }
        res.status(500).send({ error: "refresh_error" });
        console.error("Refreshing error: ", err.message);
    }
}
module.exports = {
    signIn,
    signUp,
    verifyOTP,
    refresh,
};