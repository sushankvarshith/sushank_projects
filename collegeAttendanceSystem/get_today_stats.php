<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$sn = "sql208.infinityfree.com";
$us = "if0_41383404";
$pass = "Harshini28";
$db = "if0_41383404_clgattendancedb";
$con = mysqli_connect($sn, $us, $pass, $db);

if (!$con) {
    echo json_encode(["status" => "error", "message" => "Database connection failed"]);
    exit();
}

$current_date = date("d/m/y");

$query = "SELECT * FROM `att` WHERE `date` = '$current_date'";
$result = mysqli_query($con, $query);

if (mysqli_num_rows($result) > 0) {
    $row = mysqli_fetch_assoc($result);
    
    $presentCount = 0;
    $absentCount = 0;
    $presentRolls = [];
    $absentRolls = [];
    
    foreach ($row as $column => $value) {
        if ($column !== 'date' && $column !== 'total') {
            if ($value == '1') {
                $presentCount++;
                $presentRolls[] = $column;
            } else if ($value == '0') {
                $absentCount++;
                $absentRolls[] = $column;
            }
        }
    }
    
    echo json_encode([
        "status" => "success",
        "date" => $current_date,
        "presentCount" => $presentCount,
        "absentCount" => $absentCount,
        "presentRolls" => $presentRolls,
        "absentRolls" => $absentRolls
    ]);
} else {
    echo json_encode(["status" => "not_submitted"]);
}

mysqli_close($con);
exit();
?>
