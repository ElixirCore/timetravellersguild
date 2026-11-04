<?php
// Copy to agent_auth.php and make it return true only for a signed-in citizen.
// Replace this with your real session check once /passport login exists.
session_start();
return !empty($_SESSION['citizen_id']);
