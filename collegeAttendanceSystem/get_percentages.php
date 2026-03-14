<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$sn = "sql208.infinityfree.com";
$us = "if0_41383404";
$pass = "Harshini28";
$db = "if0_41383404_clgattendancedb";

$conn = new mysqli($sn, $us, $pass, $db);

if ($conn->connect_error) {
    die(json_encode(['error' => 'Connection failed: ' . $conn->connect_error]));
}

$students = [
    '24711A3301', '24711A3302', '24711A3303', '24711A3304', '24711A3306',
    '24711A3307', '24711A3308', '24711A3311', '24711A3312', '24711A3313',
    '24711A3314', '24711A3315', '24711A3317', '24711A3318', '24711A3320',
    '24711A3321', '24711A3322', '24711A3324', '24711A3325', '24711A3327',
    '24711A3328', '24711A3329', '24711A3330', '24711A3331', '24711A3332',
    '24711A3334', '24711A3336', '24711A3337', '24711A3338', '24711A3341',
    '24711A3343', '24711A3344', '24711A3346', '24711A3348', '24711A3350',
    '24711A3353', '24711A3355', '24711A3357', '24711A3358', '24711A3364',
    '25715A3302', '25715A3303', '25715A3305'
];

$checkTable = $conn->query("SHOW TABLES LIKE 'att'");
if (!$checkTable || $checkTable->num_rows == 0) {
    die(json_encode(['error' => 'Table att not found']));
}

$result = $conn->query("SELECT COUNT(*) as totalDays FROM att");
if (!$result) {
    die(json_encode(['error' => 'Count query failed: ' . $conn->error]));
}

$row = $result->fetch_assoc();
$totalDays = (int)$row['totalDays'];

$percentages = [];

if ($totalDays == 0) {
    foreach ($students as $roll) {
        $percentages[] = [
            'roll' => $roll,
            'percentage' => 100
        ];
    }
}
else {
    foreach ($students as $roll) {
        $query = "SELECT SUM(`$roll`) AS presentDays FROM att";
        $result = $conn->query($query);

        if (!$result) {
            die(json_encode(['error' => "Query failed for $roll: " . $conn->error]));
        }

        $row = $result->fetch_assoc();
        $presentDays = isset($row['presentDays']) ? (int)$row['presentDays'] : 0;
        $absentDays = $totalDays - $presentDays;
        
        // Start from 100 and subtract 2% per absent, no +1% since we start at 100
        $percentage = 100 - ($absentDays * 2);
        
        // Ensure max 100 and min 0
        if ($percentage > 100) $percentage = 100;
        if ($percentage < 0) $percentage = 0;

        $percentages[] = [
            'roll' => $roll,
            'percentage' => round($percentage, 2)
        ];
    }
}

echo json_encode($percentages);
$conn->close();
?>