<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain');

$sn = "sql208.infinityfree.com";
$us = "if0_41383404";
$pass = "Harshini28";
$db = "if0_41383404_clgattendancedb";

$con = mysqli_connect($sn, $us, $pass, $db);

if (!$con) {
    die("db_error");
}

$date = isset($_GET['date']) ? mysqli_real_escape_string($con, $_GET['date']) : '';

if ($date == '') {
    echo "error";
    exit;
}

$check_query = "SELECT `date` FROM `att` WHERE `date` = '$date'";
$result = mysqli_query($con, $check_query);

if (!$result) {
    echo "query_error: " . mysqli_error($con);
}
elseif (mysqli_num_rows($result) > 0) {
    echo "exists";
}
else {
    echo "not_exists";
}

mysqli_close($con);
?>