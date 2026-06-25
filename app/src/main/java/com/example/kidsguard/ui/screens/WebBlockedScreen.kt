package com.example.kidsguard.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun WebBlockedScreen(
    url: String?,
    onRequestAccess: () -> Unit,
    onBackToHome: () -> Unit
) {
    var requestSent by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.1f),
                    modifier = Modifier.size(150.dp)
                )
                Icon(
                    imageVector = Icons.Default.Security,
                    contentDescription = null,
                    tint = Color.Red,
                    modifier = Modifier.size(60.dp)
                )
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Text(
                text = "WEBSITE BLOCKED",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Text(
                text = "This content is not allowed by your parent.",
                color = Color.Gray,
                textAlign = TextAlign.Center,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            
            if (url != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    color = Color.White.copy(alpha = 0.05f),
                    shape = MaterialTheme.shapes.medium
                ) {
                    Text(
                        text = url,
                        color = Color.LightGray,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        maxLines = 1,
                        textAlign = TextAlign.Center
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(48.dp))
            
            if (!requestSent) {
                Button(
                    onClick = {
                        onRequestAccess()
                        requestSent = true
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155)),
                    shape = MaterialTheme.shapes.large,
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text("REQUEST ACCESS", fontWeight = FontWeight.Bold)
                }
            } else {
                Text(
                    text = "Request sent to parent.",
                    color = Color(0xFF10B981),
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(16.dp)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            OutlinedButton(
                onClick = onBackToHome,
                shape = MaterialTheme.shapes.large,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
            ) {
                Text("GO BACK", fontWeight = FontWeight.Bold)
            }
        }
    }
}
