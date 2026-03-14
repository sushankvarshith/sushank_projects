<?php
error_reporting(0);
ini_set('display_errors', 0);

$sn = "sql208.infinityfree.com";
$us = "if0_41383404";
$pass = "Harshini28";
$db = "if0_41383404_clgattendancedb";
$con = mysqli_connect($sn, $us, $pass, $db);

if (!$con) {
    header("Location: index.html?status=error");
    exit();
}

$current_date = date("d/m/y");

// Check if attendance already exists
$check_query = "SELECT date FROM att WHERE date = '$current_date'";
$result = mysqli_query($con, $check_query);
if (mysqli_num_rows($result) > 0) {
    header("Location: index.html?status=exists&date=" . urlencode($current_date));
    exit();
}

// Build the INSERT query dynamically
$columns = "`date`";
$values = "'$current_date'";

// Process attendance data from POST
foreach ($_POST as $roll => $status) {
    if ($roll === 'date') continue;
    $status = mysqli_real_escape_string($con, $status);
    $roll = mysqli_real_escape_string($con, $roll);
    
    $columns .= ", `$roll`";
    $values .= ", '$status'";
}

$query = "INSERT INTO att (" . $columns . ") VALUES (" . $values . ")";

if (mysqli_query($con, $query)) {
    header("Location: index.html?status=success&date=" . urlencode($current_date));
} else {
    header("Location: index.html?status=error");
}

mysqli_close($con);
exit();
?>