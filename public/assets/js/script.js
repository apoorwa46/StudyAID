'use strict';



/**
 * add event on element
 */

const addEventOnElem = function (elem, type, callback) {
  if (elem.length > 1) {
    for (let i = 0; i < elem.length; i++) {
      elem[i].addEventListener(type, callback);
    }
  } else {
    elem.addEventListener(type, callback);
  }
}



/**
 * navbar toggle
 */

const navbar = document.querySelector("[data-navbar]");
const navTogglers = document.querySelectorAll("[data-nav-toggler]");
const navLinks = document.querySelectorAll("[data-nav-link]");
const overlay = document.querySelector("[data-overlay]");

const toggleNavbar = function () {
  navbar.classList.toggle("active");
  overlay.classList.toggle("active");
}

addEventOnElem(navTogglers, "click", toggleNavbar);

const closeNavbar = function () {
  navbar.classList.remove("active");
  overlay.classList.remove("active");
}

addEventOnElem(navLinks, "click", closeNavbar);



/**
 * header active when scroll down to 100px
 */

const header = document.querySelector("[data-header]");
const backTopBtn = document.querySelector("[data-back-top-btn]");

const activeElem = function () {
  if (window.scrollY > 100) {
    header.classList.add("active");
    backTopBtn.classList.add("active");
  } else {
    header.classList.remove("active");
    backTopBtn.classList.remove("active");
  }
}

addEventOnElem(window, "scroll", activeElem);



//STUDYAID SECTION


document.addEventListener('DOMContentLoaded', () => {
  const qaForm = document.querySelector('#qa .form');
  const qaResultsDiv = document.querySelector('#qa-results .qa-results');

  if (qaForm && qaResultsDiv) {
    qaForm.addEventListener('submit', async(event)=>{
      event.preventDefault();

            const formData = new FormData();
            const fileInput = qaForm.querySelector('input[type="file"]');

            if (fileInput.files.length > 0) {
                formData.append('document', fileInput.files[0]);

                qaResultsDiv.innerHTML = '<p class="loading-message">Generating Q&A... Please wait. This may take a moment for large files.</p>'; // Loading message

                try {
                    const response = await fetch('/generate-qa', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText || 'Failed to generate Q&A.');
                    }

                    const data = await response.json();
                    qaResultsDiv.innerHTML = `<p>${data.qna}</p>`;
                } catch (error) {
                    console.error('Error:', error);
                    qaResultsDiv.innerHTML = `<p class="error-message" style="color: red;">Error: ${error.message}</p>`;
                }
            } else {
                qaResultsDiv.innerHTML = '<p class="info-message" style="color: orange;">Please select a file to upload.</p>';
            }
    });

  }


  
  // --- YouTube Video Suggestion Logic (for video.html) - USING GEMINI ONLY ---
    const videoForm = document.getElementById('video-suggestion-form');
    const topicInput = document.getElementById('topic-input');
    const videoSuggestionsList = document.querySelector('.video-suggestions-list');
    const videoSectionTitle = document.querySelector('#video-results .section-title');
    const videoSectionText = document.querySelector('#video-results .section-text');

    if (videoForm && topicInput && videoSuggestionsList) {
        videoForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission

            const topic = topicInput.value.trim();
            if (!topic) {
                alert('Please enter a topic to get video suggestions.');
                return;
            }

            // Show loading state
            videoSuggestionsList.innerHTML = '<p class="loading-message">Loading video suggestions...</p>';
            // Update section title and text (assuming #video-results exists and contains these)
            if (videoSectionTitle) videoSectionTitle.textContent = 'Suggested Videos';
            if (videoSectionText) videoSectionText.textContent = 'Here are some YouTube videos you might find helpful:';


            try {
                // Make a GET request to your backend endpoint
                const response = await fetch(`/api/video-suggestions?topic=${encodeURIComponent(topic)}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch video suggestions from server.');
                }

                const data = await response.json();
                const videos = data.videos;

                videoSuggestionsList.innerHTML = ''; // Clear previous results

                if (videos.length === 0) {
                    videoSuggestionsList.innerHTML = '<p class="no-results-message">No videos found for this topic. Try a different one.</p>';
                    return;
                }

                videos.forEach(video => {
                    const videoCard = document.createElement('div');
                    videoCard.classList.add('video-card');

                    // Create thumbnail image
                    const thumbnail = document.createElement('img');
                    thumbnail.src = video.thumbnail;
                    thumbnail.alt = video.title;
                    thumbnail.style.width = '100%';
                    thumbnail.style.height = '180px';
                    thumbnail.style.objectFit = 'cover';
                    thumbnail.style.borderRadius = 'var(--radius-10) var(--radius-10) 0 0';

                    // Create card content div
                    const cardContent = document.createElement('div');
                    cardContent.classList.add('card-content');

                    // Create video title link
                    const cardTitle = document.createElement('h3');
                    cardTitle.classList.add('card-title');
                    const titleLink = document.createElement('a');
                    titleLink.href = `https://www.youtube.com/watch?v=${video.id}`; // Direct YouTube link
                    titleLink.target = '_blank'; // Open in new tab
                    titleLink.rel = 'noopener noreferrer'; // Security best practice
                    titleLink.textContent = video.title;
                    cardTitle.appendChild(titleLink);

                    // Create channel title
                    const channelName = document.createElement('p');
                    channelName.textContent = `Channel: ${video.channelTitle}`;
                    channelName.style.fontSize = 'var(--fs-7)';
                    channelName.style.color = 'var(--gray-web)';
                    channelName.style.marginBottom = '10px';

                    // Append elements to card content
                    cardContent.appendChild(cardTitle);
                    cardContent.appendChild(channelName);

                    // Append elements to video card
                    videoCard.appendChild(thumbnail);
                    videoCard.appendChild(cardContent);

                    // Append video card to the list
                    videoSuggestionsList.appendChild(videoCard);
                });

            } catch (error) {
                console.error('Error in video suggestions:', error);
                videoSuggestionsList.innerHTML = `<p class="error-message">Error: ${error.message}. Please try again.</p>`;
            }
        });
    }




    // --- Summary Generator Logic (for summary.html) ---
    const summaryForm = document.querySelector('#summary-generator .form');
    const summaryResultsDiv = document.querySelector('#summary-results .summary-results');

    if (summaryForm && summaryResultsDiv) {
        summaryForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData();
            const fileInput = summaryForm.querySelector('input[type="file"]');

            if (fileInput.files.length > 0) {
                formData.append('document', fileInput.files[0]);

                summaryResultsDiv.innerHTML = '<p class="loading-message">Generating summary... Please wait. This may take a moment for large files.</p>'; // Loading message

                try {
                    const response = await fetch('/generate-summary', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(errorText || 'Failed to generate summary.');
                    }

                    const data = await response.json();
                    summaryResultsDiv.innerHTML = `<p>${data.summary}</p>`;
                } catch (error) {
                    console.error('Error:', error);
                    summaryResultsDiv.innerHTML = `<p class="error-message" style="color: red;">Error: ${error.message}</p>`;
                }
            } else {
                summaryResultsDiv.innerHTML = '<p class="info-message" style="color: orange;">Please select a file to upload.</p>';
            }
        });
    }

});



