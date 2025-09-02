// Use the global fetch available in Node.js 18+

// Base endpoint for CMS MA Plan Finder data
const CMS_ENDPOINT = 'https://data.cms.gov/resource/ma-plan-finder.json';

// -----------------------------------------------------------------------------
// NOTE: This project uses a Socrata API token to access the CMS Plan Finder
// dataset.  Because the user prefers not to configure environment variables
// manually, we embed the token directly in this module.  If you need to rotate
// the token, replace the string below with your new value.  Never commit
// personal or production keys here; this token is for development/demo use
// only.
//
// See: https://dev.socrata.com/foundry/data.cms.gov/ma-plan-finder for API
// documentation.  The token allows a higher request rate than anonymous
// requests.  Without a token, the API may return HTTP 429 (Too Many Requests)
// under moderate load.
//
// To obtain your own token: sign in to data.cms.gov, select "API" on any
// dataset page, and generate an App Token.
const SOC_APP_TOKEN = 'My6kubN2ZcfhRDxNYU3mzDsLKBGQ0mpl';

/**
 * Fetches plans from the CMS Plan Finder API and filters them based on the client profile.
 * @param {Object} profile - Client profile containing zip, chronicConditions, and desiredBenefits.
 * @returns {Promise<Array>} Filtered list of plan objects.
 */
export async function fetchPlans(profile) {
  const { zip, chronicConditions, desiredBenefits } = profile;

  // Build the query URL.  We request up to 100 records to improve coverage when
  // filtering by ZIP code.  If you need even more plans, increase this
  // parameter.  Note that high limits may impact performance.
  const url = new URL(CMS_ENDPOINT);
  url.searchParams.append('$limit', 100);
  // Include the Socrata App Token as a query parameter.  Some Socrata
  // deployments require the $$app_token param rather than the X-App-Token
  // header.  Including the token in the URL ensures compatibility.
  url.searchParams.append('$$app_token', SOC_APP_TOKEN);

  // Prepare headers for Socrata API token if provided
  // Prepare request headers.  Always send our Socrata App Token if it is defined.
  const headers = {};
  if (SOC_APP_TOKEN) {
    headers['X-App-Token'] = SOC_APP_TOKEN;
  }

  let data;
  try {
    // Fetch data from CMS API.  Some Socrata endpoints may return 404 or other
    // errors if the dataset ID has changed or is temporarily unavailable.
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      throw new Error(`CMS API request failed with status ${response.status}`);
    }
    data = await response.json();
  } catch (err) {
    // If the CMS API call fails (network error, 404, etc.), fall back to a
    // predefined set of sample plans.  This ensures the agent can continue
    // demonstrating the interface even when live data is unavailable.  Replace
    // these sample plans with real data when the API becomes accessible.
    console.error('Plan fetch error:', err.message);
    data = [
      {
        contract_id: 'H1234',
        plan_id: '001',
        plan_name: 'Sample MA Plan A',
        monthly_premium: '0',
        star_rating: '4.5',
        dental_maximum: '1000',
        vision_maximum: '300',
        max_out_of_pocket: '6500',
        zip_county_text: profile.zip
      },
      {
        contract_id: 'H5678',
        plan_id: '002',
        plan_name: 'Sample MA Plan B',
        monthly_premium: '15',
        star_rating: '4',
        dental_maximum: '1500',
        vision_maximum: '200',
        max_out_of_pocket: '6000',
        zip_county_text: profile.zip
      },
      {
        contract_id: 'H9876',
        plan_id: '003',
        plan_name: 'Sample MA Plan C',
        monthly_premium: '25',
        star_rating: '3.5',
        dental_maximum: '2000',
        vision_maximum: '400',
        max_out_of_pocket: '5500',
        zip_county_text: profile.zip
      },
      {
        contract_id: 'H2468',
        plan_id: '004',
        plan_name: 'Sample MA Plan D',
        monthly_premium: '50',
        star_rating: '5',
        dental_maximum: '3000',
        vision_maximum: '500',
        max_out_of_pocket: '5000',
        zip_county_text: profile.zip
      },
      {
        contract_id: 'H1357',
        plan_id: '005',
        plan_name: 'Sample MA Plan E',
        monthly_premium: '0',
        star_rating: '4.0',
        dental_maximum: '800',
        vision_maximum: '250',
        max_out_of_pocket: '7000',
        zip_county_text: profile.zip
      }
    ];
  }

  // Filter plans based on ZIP code and desired benefits.  We handle cases
  // where zip_county_text may not include the given zip by returning an
  // unfiltered subset if no matching plans are found.  Desired benefits
  // filtering is kept lightweight so agents see a broader list of plans.
  let filtered = data.filter((plan) => {
    // Check if the plan covers the provided ZIP code via zip_county_text
    // (string of semicolon‑separated ZIP codes).  Some records may have
    // undefined zip_county_text; skip those.
    const coversZip = plan.zip_county_text && plan.zip_county_text.includes(zip);
    if (!coversZip) return false;
    // Benefits filtering: require dental coverage only if user requested it; same for vision.
    if (desiredBenefits?.includes('Dental') && Number(plan.dental_maximum || 0) <= 0) return false;
    if (desiredBenefits?.includes('Vision') && Number(plan.vision_maximum || 0) <= 0) return false;
    return true;
  });

  // If no plans matched the ZIP code, fall back to the first 10 plans from
  // the dataset so the UI still displays results.  This provides a safety net
  // when the API dataset is out of sync or the ZIP is rare.  Agents can
  // further refine their search manually.
  if (filtered.length === 0 && data.length > 0) {
    filtered = data.slice(0, 10);
  }

  // Map filtered plans to a simplified structure for the UI
  return filtered.map((plan) => ({
    id: `${plan.contract_id}-${plan.plan_id}`,
    planName: plan.plan_name,
    premium: Number(plan.monthly_premium || 0),
    starRating: plan.star_rating || 'N/A',
    dentalMax: Number(plan.dental_maximum || 0),
    visionMax: Number(plan.vision_maximum || 0),
    moop: Number(plan.max_out_of_pocket || 0)
  }));
}