// This script handles form submission and AI recommendation logic for the Chrome extension popup
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('clientForm');
  const resultDiv = document.getElementById('result');

  // Handle form submission to fetch plans
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    resultDiv.textContent = 'Loading plans...';
    const data = gatherFormData();
    try {
      const response = await fetch('http://localhost:3000/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const plans = await response.json();
      displayPlans(plans);
    } catch (err) {
      console.error(err);
      resultDiv.textContent = 'Error fetching plans.';
    }
  });

  // Handle AI recommendation button click
  document.getElementById('recommendBtn').addEventListener('click', async () => {
    const selectedPlan = document.querySelector('input[name="selectedPlan"]:checked');
    if (!selectedPlan) {
      resultDiv.textContent = 'Please select a plan first.';
      return;
    }
    const data = gatherFormData();
    data.planId = selectedPlan.value;
    resultDiv.textContent = 'Generating AI recommendation...';
    try {
      const response = await fetch('http://localhost:3000/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const aiOutput = await response.json();
      displayAIResponse(aiOutput);
    } catch (err) {
      console.error(err);
      resultDiv.textContent = 'Error generating recommendation.';
    }
  });

  // Collect form data into a plain object
  function gatherFormData() {
    return {
      zip: document.getElementById('zip').value,
      // Date of Birth is omitted from the form.  If needed in the future, it will
      // be scraped directly from Sunfire.
      medicaid: document.getElementById('medicaid').checked,
      lis: document.getElementById('lis').checked,
      dsnp: document.getElementById('dsnp').checked,
      chronicConditions: Array.from(document.querySelectorAll('input[name="chronic"]:checked')).map((el) => el.value),
      desiredBenefits: Array.from(document.querySelectorAll('input[name="benefit"]:checked')).map((el) => el.value)
    };
  }

  // Display fetched plans in the result div
  function displayPlans(plans) {
    if (!plans.length) {
      resultDiv.textContent = 'No plans found.';
      return;
    }
    resultDiv.innerHTML = '<h3>Available Plans</h3>';
    plans.forEach((plan) => {
      const planDiv = document.createElement('div');
      planDiv.className = 'plan-item';
      planDiv.innerHTML = `
        <label>
          <input type="radio" name="selectedPlan" value="${plan.id}">
          <strong>${plan.planName}</strong><br>
          Premium: $${plan.premium} &nbsp;|&nbsp; Star Rating: ${plan.starRating}<br>
          Dental: $${plan.dentalMax} &nbsp;|&nbsp; Vision: $${plan.visionMax}<br>
          MOOP: $${plan.moop}
        </label>
      `;
      resultDiv.appendChild(planDiv);
    });
  }

  // Display AI-generated pitch and rebuttals
  function displayAIResponse(aiOutput) {
    resultDiv.innerHTML = `
      <h3>AI Recommendation</h3>
      <p><strong>Pitch:</strong> ${aiOutput.pitch}</p>
      <p><strong>Rebuttals:</strong></p>
      <ol>
        ${aiOutput.rebuttals.map((r) => `<li>${r}</li>`).join('')}
      </ol>
    `;
  }
});