////////////////////////////////////////////////////////////////
//SOCIAL.JS
//THIS IS THE "CONTROLLER" FOR THE SOCIAL PAGE (social.html)
//SPRINT 1: LAYOUT ONLY. IT CHECKS FOR THE JWT TOKEN AND HANDLES LOG OUT.
//LATER SPRINTS: LOAD AND POST REVIEWS THROUGH DataModel.
////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {

    //////////////////////////////////////////
    //CHECK FOR TOKEN AS SOON AS THE PAGE LOADS
    //////////////////////////////////////////
    // If the user isn't logged in, send them back to the logon page
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        window.location.href = '/';
        return;
    }
    DataModel.setToken(token);

    //////////////////////////////////////////
    //EVENT LISTENERS
    //////////////////////////////////////////
    // Log out: remove the token and go back to the logon page
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/';
    });
});
