from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import cv2
import mediapipe as mp
import numpy as np
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

# Initialize MediaPipe hand detector
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    min_detection_confidence=0.8,
    min_tracking_confidence=0.8,
    max_num_hands=1
)
FINGER_TIPS = [8, 12, 16, 20]
THUMB_TIP = 4
THUMB_IP = 2

@app.route("/gesture", methods=["POST", "OPTIONS"])
@cross_origin()
def detect_gesture():
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return jsonify({"message": "CORS preflight"}), 200

    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image received"}), 400

    try:
        image_data = data["image"].split(",")[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)
        image_np = cv2.flip(image_np, 1)  # Flip for mirror effect

        results = hands.process(image_np)

        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            landmarks = hand_landmarks.landmark
            hand_label = results.multi_handedness[0].classification[0].label
            fingers_extended = 0

            for tip in FINGER_TIPS:
                if landmarks[tip].y < landmarks[tip - 2].y:
                    fingers_extended += 1

            if hand_label == "Right":
                if landmarks[THUMB_TIP].x < landmarks[THUMB_IP].x:
                    fingers_extended += 1
            else:
                if landmarks[THUMB_TIP].x > landmarks[THUMB_IP].x:
                    fingers_extended += 1

            # Map to command
            cmd = "stop"
            if fingers_extended == 1:
                cmd = "forward"
            elif fingers_extended == 2:
                cmd = "left"
            elif fingers_extended == 3:
                cmd = "right"
            elif fingers_extended == 4:
                cmd = "backward"

            print("Detected:", cmd)
            return jsonify({"command": cmd})

        return jsonify({"command": "stop"})

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)