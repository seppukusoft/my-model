document.addEventListener("DOMContentLoaded", function () {
  const dataUrl = "https://projects.fivethirtyeight.com/polls/data/president_polls.csv";
  const weightsUrl = "https://raw.githubusercontent.com/seppukusoft/538-bias-marker/main/list.json"; // JSON array URL
  let data = [];
  let weights = {};

  // 2024 Electoral College values by state
  const electoralVotesMapping = {
    "Alabama": 9,
    "Alaska": 3,
    "Arizona": 11,
    "Arkansas": 6,
    "California": 54,
    "Colorado": 10,
    "Connecticut": 7,
    "Delaware": 3,
    "District of Columbia": 3,
    "Florida": 30,
    "Georgia": 16,
    "Hawaii": 4,
    "Idaho": 4,
    "Illinois": 19,
    "Indiana": 11,
    "Iowa": 6,
    "Kansas": 6,
    "Kentucky": 8,
    "Louisiana": 8,
    "Maine": 2,
    "Maine CD-1": 1,
    "Maine CD-2": 1,
    "Maryland": 10,
    "Massachusetts": 11,
    "Michigan": 15,
    "Minnesota": 10,
    "Mississippi": 6,
    "Missouri": 10,
    "Montana": 4,
    "Nebraska": 4,
    "Nebraska CD-2": 1,
    "Nevada": 6,
    "New Hampshire": 4,
    "New Jersey": 14,
    "New Mexico": 5,
    "New York": 28,
    "North Carolina": 16,
    "North Dakota": 3,
    "Ohio": 17,
    "Oklahoma": 7,
    "Oregon": 8,
    "Pennsylvania": 19,
    "Rhode Island": 4,
    "South Carolina": 9,
    "South Dakota": 3,
    "Tennessee": 11,
    "Texas": 40,
    "Utah": 6,
    "Vermont": 3,
    "Virginia": 13,
    "Washington": 12,
    "West Virginia": 4,
    "Wisconsin": 10,
    "Wyoming": 3
  };
  let x = 30; // Initialize x with a default value

  // Function to update x based on dropdown selection
  function updateX(selectedValue) {
      x = parseInt(selectedValue, 10); // Convert string to integer
      console.log(`Updated value of x: ${x}`);
      updateResults(document.getElementById("stateDropdown").value);
  }

  // Populate the dropdown for x selection
  function populateXDropdown() {
      const xDropdown = d3.select("#xDropdown");

      xDropdown.on("change", function () {
          updateX(this.value);
      });
  }

// Call populateXDropdown in the appropriate place (after fetching data)
populateXDropdown();

  // Function to check if the CSV URL is reachable
  async function checkURL(url) {
      console.log("Checking URL:", url);
      try {
          const response = await fetch(url, { method: 'HEAD' });
          if (!response.ok) {
              throw new Error('Network response was not ok');
          }
          console.log("URL is reachable:", url);
          return true;
      } catch (error) {
          console.error("Error accessing the URL:", error);
          return false;
      }
  }

  async function fetchPollsterWeights(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const weights = await response.json();
        console.log("Pollster weights fetched:", weights);
        return weights[0]; // Assuming the data is in the first object of the array
    } catch (error) {
        console.error("Error fetching pollster weights:", error);
        return {};
    }
  }

  // Fetch and parse CSV data
  async function fetchAndParseCSV(url) {
      try {
          console.log("Fetching CSV...");
          const response = await fetch(url);
          const csvText = await response.text();
          const parsedData = Papa.parse(csvText, { header: true, dynamicTyping: true });
          console.log("CSV Data Parsed:", parsedData.data);
          return parsedData.data;
      } catch (error) {
          console.error("Error fetching CSV:", error);
          return [];
      }
  }

  function calculateWeightedPolls(pollData, weights) {
    return pollData.map(poll => {
        let weight = 1; // Default weight

        if (weights.red.includes(poll.pollster)) {
            weight = 0.5; // 50% weight for red
        } else if (weights.leanred.includes(poll.pollster) || weights.leanblue.includes(poll.pollster)) {
            weight = 0.75; // 25% weight for leanred or leanblue
        } else if (weights.blue.includes(poll.pollster)) {
            weight = 0.5; // 50% weight for blue
        } else if (weights.unreliable.includes(poll.pollster)) {
            weight = 0.25; // 75% weight for unreliable
        }

        return {
            ...poll,
            weightedPct: poll.pct * weight // Apply the weight to the percentage
        };
    });
}


  // Populate the dropdown with states
  function populateDropdown(data) {
    const dropdown = d3.select("#stateDropdown");
    const states = [...new Set(data.map(d => d.state).filter(Boolean))]; // Get unique states
    states.sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a.localeCompare(b);
    });
    states.forEach(state => {
        // Temporarily call updateResults for each state to check if it returns valid data
        const stateHasPollingData = checkStatePollingData(state);

        // Only add the state to the dropdown if it has valid polling data
        if (stateHasPollingData) {
            dropdown.append("option")
                .attr("value", state)
                .text(state);
        }
    });

    // Set default to national
    updateResults("national");

    // Listen for dropdown changes
    dropdown.on("change", function () {
        const selectedState = this.value;
        updateResults(selectedState);
    });
  }

  function checkStatePollingData(state) {
    let filteredData = data.filter(d => d.state === state);
    filteredData = filterByRecentDates(filteredData); // Filter by recent data (3 weeks)

    // Return true if there is any polling data for the state, false otherwise
    return filteredData.length > 0;
}

function calculateWeightedPolls(pollData, weights) {
  return pollData.map(poll => {
      let weight = 1; // Default weight

      // Check weight for the pollster
      if (weights.red && weights.red.includes(poll.pollster)) {
          weight = 0.5; // 50% weight for red
          console.log(`Weight for ${poll.pollster}: ${weight} (Red)`);
      } else if (weights.leanred && weights.leanred.includes(poll.pollster)) {
          weight = 0.75; // 25% weight for leanred
          console.log(`Weight for ${poll.pollster}: ${weight} (Lean Red)`);
      } else if (weights.leanblue && weights.leanblue.includes(poll.pollster)) {
          weight = 0.75; // 25% weight for leanblue
          console.log(`Weight for ${poll.pollster}: ${weight} (Lean Blue)`);
      } else if (weights.blue && weights.blue.includes(poll.pollster)) {
          weight = 0.5; // 50% weight for blue
          console.log(`Weight for ${poll.pollster}: ${weight} (Blue)`);
      } else if (weights.unreliable && weights.unreliable.includes(poll.pollster)) {
          weight = 0.25; // 75% weight for unreliable
          console.log(`Weight for ${poll.pollster}: ${weight} (Unreliable)`);
      }

      // Check weight for the sponsors
      if (weights.red && weights.red.includes(poll.sponsor)) {
          weight = Math.min(weight, 0.5); // 50% weight for red
          console.log(`Weight for ${poll.sponsor}: ${weight} (Red Sponsor)`);
      } else if (weights.leanred && weights.leanred.includes(poll.sponsor)) {
          weight = Math.min(weight, 0.75); // 25% weight for leanred
          console.log(`Weight for ${poll.sponsor}: ${weight} (Lean Red Sponsor)`);
      } else if (weights.leanblue && weights.leanblue.includes(poll.sponsor)) {
          weight = Math.min(weight, 0.75); // 25% weight for leanblue
          console.log(`Weight for ${poll.sponsor}: ${weight} (Lean Blue Sponsor)`);
      } else if (weights.blue && weights.blue.includes(poll.sponsor)) {
          weight = Math.min(weight, 0.5); // 50% weight for blue
          console.log(`Weight for ${poll.sponsor}: ${weight} (Blue Sponsor)`);
      } else if (weights.unreliable && weights.unreliable.includes(poll.sponsor)) {
          weight = Math.min(weight, 0.25); // 75% weight for unreliable
          console.log(`Weight for ${poll.sponsor}: ${weight} (Unreliable Sponsor)`);
      }

      const weightedPct = poll.pct * weight; // Apply the weight to the percentage
      console.log(`Pollster: ${poll.pollster}, Sponsor: ${poll.sponsor}, Original Pct: ${poll.pct}, Weighted Pct: ${weightedPct}`);

      return {
          ...poll,
          weightedPct // Use the calculated weighted percentage
      };
  });
}



  // Filter polls to only include the last 3 weeks
  function filterByRecentDates(data) {
      const now = new Date();
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setDate(now.getDate() - x); // 30d ago

      return data.filter(d => {
          const pollDate = new Date(d.end_date); // Adjust if your CSV uses a different date column
          return pollDate >= threeWeeksAgo && pollDate <= now;
      });
  }

  // Calculate win probability using Monte Carlo simulation
  function calculateWinProbability(candidates, iterations = 1000000) {
      const results = {};

      // Initialize result counts
      candidates.forEach((candidate) => {
          results[candidate.name] = 0;
      });

      // Monte Carlo simulation
      for (let i = 0; i < iterations; i++) {
          const randomResults = candidates.map(candidate => ({
              name: candidate.name,
              result: candidate.percentage + (Math.random() - 0.9) * 40 // simulate some randomness
          }));

          const winner = randomResults.reduce((prev, curr) => (curr.result > prev.result ? curr : prev));
          results[winner.name] += 1;
      }

      // Convert counts to probabilities
      const probabilities = {};
      Object.keys(results).forEach(candidate => {
          probabilities[candidate] = (results[candidate] / iterations) * 100;
      });

      return probabilities;
  }

  function calculateTotalElectoralVotes(data) {
    const totalElectoralVotes = {};

    // Process each state
    Object.keys(electoralVotesMapping).forEach(state => {
        const stateData = data.filter(d => d.state === state);

        // Filter data for the last 3 weeks
        const recentData = filterByRecentDates(stateData);

        if (recentData.length > 0) {
            // Group candidates by name
            const candidates = d3.group(recentData, d => d.candidate_name);

            let highestPercentage = -Infinity;
            let winningCandidate = null;

            // Find the candidate with the highest percentage in each state
            candidates.forEach((candidateData, candidateName) => {
                const percentage = d3.mean(candidateData, d => d.pct);
                if (percentage > highestPercentage) {
                    highestPercentage = percentage;
                    winningCandidate = candidateName;
                }
            });

            if (winningCandidate) {
                // Add the electoral votes for the winning candidate in this state
                totalElectoralVotes[winningCandidate] = (totalElectoralVotes[winningCandidate] || 0) + electoralVotesMapping[state];
                console.log(`State: ${state}, Winning Candidate: ${winningCandidate}, Electoral Votes: ${electoralVotesMapping[state]}`);
            }
        } else {
            console.log(`No recent polling data for ${state}`);
            const stateElectoralVotes = electoralVotesMapping[state];

            // Add to Harris for specified states
            if (["District of Columbia", "Hawaii", "Illinois", "New Jersey", "Oregon", "Vermont", "Washington"].includes(state)) {
                totalElectoralVotes["Kamala Harris"] = (totalElectoralVotes["Kamala Harris"] || 0) + stateElectoralVotes;
            } else {
                // Add to Trump for other states
                totalElectoralVotes["Donald Trump"] = (totalElectoralVotes["Donald Trump"] || 0) + stateElectoralVotes;
            }
        }
    });

    console.log("Total Electoral Votes:", totalElectoralVotes);
    return totalElectoralVotes;
}



  function displayTotalElectoralVotes(totalElectoralVotes) {
    const totalElectoralVotesText = Object.entries(totalElectoralVotes)
        .map(([candidate, votes]) => `${candidate}: ${votes}`)
        .join(", ");
    d3.select("#totalElectoralVotes").text(`Total Electoral Votes: ${totalElectoralVotesText}`);
  }

  // Update results for selected state
  function updateResults(selectedState) {
      console.log(`Selected state: ${selectedState}`);

      let filteredData;

      // Filter based on selected state
      if (selectedState === "national") {
          filteredData = data.filter(d => d.state && d.state.toLowerCase() === "national");
      } else {
          filteredData = data.filter(d => d.state === selectedState);
      }

      // Further filter to only include polls from the past 3 weeks
      filteredData = filterByRecentDates(filteredData).filter(d => d.candidate_name.toLowerCase() !== "joe biden" || "robert f. kennedy");

      console.log("Filtered Data (past 3 weeks):", filteredData); // Log filtered data for debugging

      if (filteredData.length === 0) {
        console.log(`No data found for state: ${selectedState}`);
        return;
    }
      // Inside the updateResults function, after filtering data
      const weightedData = calculateWeightedPolls(filteredData, weights);

      // Group candidates by name
      const candidates = d3.group(weightedData, d => d.candidate_name);
      const candidatesData = Array.from(candidates).map(([name, group]) => {
        const meanPct = d3.mean(group, d => d.weightedPct); // Use weightedPct for calculation
        console.log(`Candidate: ${name}, Mean Weighted Percentage: ${meanPct}`);
        return { name, percentage: meanPct };
      });
      console.log("Candidates Data for Win Probability:", candidatesData); // Log candidates data
      let totalVotes = 0;
      const probabilityText = [];
      const voteShareText = [];
      const electoralVotesList = d3.select("#electoralVotes").html(""); // Clear previous

      // Create a list of candidates for win probability simulation
      const candidateList = [];

      candidates.forEach((candidateData, candidateName) => {
          const party = candidateData[0].party;
          const percentage = d3.mean(candidateData, d => d.pct);
          if (percentage > 0) {
            // Push data for win probability simulation
            candidateList.push({ name: candidateName, percentage });

            // Calculate total vote share
            totalVotes += percentage;

            // Store vote share text
            voteShareText.push(`${candidateName}: ${percentage.toFixed(2)}%`);
        }
    });

    const winProbabilities = calculateWinProbability(candidatesData);
    Object.entries(winProbabilities).forEach(([candidate, probability]) => {
        // Only include candidates with a win probability greater than 1%
        if (probability > 2) {
            probabilityText.push(`${candidate}: ${probability.toFixed(2)}%`);
        }
    });

    // Display overall results
    d3.select("#probability").text(`Win Probability: ${probabilityText.join(", ")}`)
      d3.select("#voteShare").text(`Popular Vote Estimate: ${voteShareText.join(", ")}`);

      // Calculate and display total electoral votes (now done in the background for all states)
      const totalElectoralVotes = calculateTotalElectoralVotes(data);
      displayTotalElectoralVotes(totalElectoralVotes);
  }

  // Initialize app by fetching the data and setting up the dropdown
  checkURL(dataUrl).then(isReachable => {
    if (isReachable) {
        Promise.all([
            fetchAndParseCSV(dataUrl),
            fetchPollsterWeights(weightsUrl) // Fetch the weights
        ]).then(([fetchedData, fetchedWeights]) => {
            data = fetchedData;
            weights = fetchedWeights; // Store the fetched weights
            populateDropdown(data);
            const totalElectoralVotes = calculateTotalElectoralVotes(data);
            displayTotalElectoralVotes(totalElectoralVotes);
        });
    } else {
        console.error("CSV URL is not reachable");
    }
});
});