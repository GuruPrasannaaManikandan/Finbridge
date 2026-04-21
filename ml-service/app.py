@app.route("/predict-loan-risk", methods=["POST"])
def predict():
    data = request.json

    income = data["income"]
    emi = data["emi"]
    existing_loans = data["existing_loans"]
    credit_score = data["credit_score"]

    # Calculate DTI inside backend
    dti = (emi / income) * 100 if income > 0 else 0

    features = np.array([[income, emi, existing_loans, credit_score, dti]])

    probability = model.predict_proba(features)[0][1]
    risk = "High Risk" if probability > 0.5 else "Low Risk"

    return jsonify({
        "default_probability": round(float(probability), 2),
        "risk": risk,
        "dti": round(float(dti), 2)
    })
