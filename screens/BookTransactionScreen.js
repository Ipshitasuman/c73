import React from 'react';
import { Text, View, TouchableOpacity, TextInput, Image, StyleSheet, KeyboardAvoidingView, Alert, ToastAndroid} from 'react-native';
import * as Permissions from 'expo-permissions';
import { BarCodeScanner } from 'expo-barcode-scanner';
import firebase from 'firebase';
import db from '../config';


export default class TransactionScreen extends React.Component {
  constructor(){
    super();
    this.state = {
      hasCameraPermissions : null,
      scanned : false,
      scannedBookId : '',
      scannedStudentId : '',
      buttonState : 'normal',
      transactionMessage : ''
    }
  }

  getCameraPermissions = async (id) =>{
    const {status}  = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      /*status === "granted" is true when user has granted permission
        status === "granted" is false when user has not granted the permission
      */
      hasCameraPermissions : status === "granted",
      buttonState : id,
      scanned : false
    })
  }

  handleBarCodeScanned  = async ({type, data})=>{
    const { buttonState} = this.state

    if(buttonState === "BookId"){
      this.setState({
        scanned : true,
        scannedBookId : data,
        buttonState : 'normal'
      });
    }
    else if(buttonState === "StudentId"){
      this.setState({
        scanned : true,
        scannedStudentId : data,
        buttonState : 'normal'
      })
    }
  }

  initiateBookIssue = async ()=>{
    //add a transaction
    db.collection("transaction").add({
      'studentId' : this.state.scannedStudentId,
      'bookId' : this.state.scannedBookId,
      'data' : firebase.firestore.Timestamp.now().toDate(),
      'transactionType' : "Issue"
    })

    //change book status
    db.collection("books").doc(this.state.scannedBookId).update({
      'bookAvailability' : false
    })
    //change number of issued books for student
    db.collection("students").doc(this.state.scannedStudentId).update({
      'numberOfBooksIssued' : firebase.firestore.FieldValue.increment(1)
    })

    this.setState({
      scannedStudentId : '',
      scannedBookId: ''
    })
  }

  initiateBookReturn = async ()=>{
    //add a transaction
    db.collection("Transaction").add({
      'studentId' : this.state.scannedStudentId,
      'bookId' : this.state.scannedBookId,
      'date'   : firebase.firestore.Timestamp.now().toDate(),
      'transactionType' : "Return"
    })

    //change book status
    db.collection("Book").doc(this.state.scannedBookId).update({
      'bookAvailability' : true
    })

    //change book status
    db.collection("Students").doc(this.state.scannedStudentId).update({
      'numberOfBooksIssued' : firebase.firestore.FieldValue.increment(-1)
    })

    this.setState({
      scannedStudentId : '',
      scannedBookId : ''
    })
  }

  checkBookEligibility= async () =>{
    const bookRef = await db 
    .collection("Book")
    .where("bookID", "==", this.state.scannedBookId)
    .get();

    var transactionType = "";
    if(bookRef.docs.length == 0){
     transactionType = false;
     this.setState({
      scannedStudentId : '',
      scannedBookId : ''
    })
    } else{
      bookRef.docs.map(doc =>{
        var book = doc.data();
        if(book.bookAvailability){
          transactionType = "Issue";
          this.setState({
            scannedStudentId : '',
            scannedBookId : ''
          })
        } else{
          transactionType = "Return";
          this.setState({
            scannedStudentId : '',
            scannedBookId : ''
          })
        }
      })
    }
    return transactionType ;
  }

  checkStudentEligibilityforBookIssue = async() =>{
    const studentRef = await db 
    .collection("Students")
    .where("studentID", "==", this.scannedStudentId)
    .get();

    var isStudentEligible =  "";
    if(studentRef.docs.length == 0){
      isStudentEligible = false;
      this.setState({
        scannedStudentId : '',
        scannedBookId : ''
      })
      Alert.alert("The student ID doesn't exist in the database")
    } else {
      studentRef.docs.map(doc => {
        var student = doc.data();
        if (student.numberOfBooksIssued < 2){
           isStudentEligible = true;
           this.setState({
            scannedStudentId : '',
            scannedBookId : ''
          })
        } else{
          isStudentEligible = false;
          Alert.alert("The student has alredy issue two books");
          this.setState({
            scannedStudentId : '',
            scannedBookId : ''
          })
        }
      })
    }
    return isStudentEligible
  }

  checkStudentEligibilityforBookReturn = async() =>{
    const transactionRef = await db 
    .collection("Transaction")
    .where("bookID", "==", this.scannedBookId)
    .limit(1)
    .get();

    var isStudentEligible =  "";
    transactionRef.docs.map(doc =>{
      var lastBookTransaction = doc.data();
      if(lastBookTransaction.studentId === this.state.scannedStudentId){
        isStudentEligible = true;
        this.setState({
          scannedStudentId : '',
          scannedBookId : ''
        })
      } else {
         isStudentEligible = false;
         Alert.alert("The Book wasn't issued by this student");
         this.setState({
          scannedStudentId : '',
          scannedBookId : ''
        })
      }
    })
      return isStudentEligible;
   }

  



  handleTransaction = async()=>{
    /* verify if the student is eligible
    student id exists in the database
    issue : no of books issued < 2 
    issue : verify book availaibility
    return : last transaction => book issued by the student id*/
  
    var transactionType = await this.checkBookEligibility();
    if(! transactionType ){
       Alert.alert("The book doesn't exist in the library database");
       this.setState({
        scannedBookId : '',
        scannedStudentId : ''
       })
    } else if (transactionType === "Issue"){
       var isStudentEligible = await this.checkStudentEligibilityforBookIssue();
       if(isStudentEligible){
          this.initiateBookIssue();
          Alert.alert("Book Issued to the student");
       }
    } else {
       var isStudentEligible = await this.checkStudentEligibilityforReturn();
       if(isStudentEligible){
         this.initiateBookReturn();
         Alert.alert("Book Returned by the student");
       }
    }
    // db.collection("books").doc(this.state.scannedBookId).get()
    // .then((doc)=>{
    //   var book = doc.data()
    //   if(book.bookAvailability){
    //     this.initiateBookIssue();
    //     transactionMessage = "Book Issued"
    //     // Alert.alert(transactionMessage);
    //     ToastAndroid.show(transactionMessage,ToastAndroid.SHORT);
    //   }
    //   else{
    //     this.initiateBookReturn();
    //     transactionMessage = "Book Returned"
    //     // Alert.alert(transactionMessage);
    //     ToastAndroid.show(transactionMessage,ToastAndroid.SHORT);
    //   }
    // })

    // this.setState({
    //   transactionMessage : transactionMessage
    // })
  }

  render(){
    const hasCameraPermissions = this.state.hasCameraPermissions;
    const scanned = this.state.scanned;
    const buttonState = this.state.buttonState;

    if(buttonState !== "normal" && hasCameraPermissions){
      return(
        <BarCodeScanner
          onBarCodeScanned = {scanned ? undefined : this.handleBarCodeScanned}
          style = {StyleSheet.absoluteFillObject}
        />
      );
    }

    else if (buttonState === "normal"){
      return(
        <KeyboardAvoidingView style = {styles.container} behavior = "padding" enabled>
        <View style={styles.container}>
        <View>
          <Image
            source = {require("../assets/booklogo.jpg")}
            style= {{width:200, height:200}}/>
          <Text style={{textAlign:'center', fontSize:30,}}>Wily</Text>
        </View>
        <View style={styles.inputView}>
        <TextInput
          style={styles.inputBox}
          placeholder="Book Id"
          onChangeText = {text => this.setState({scannedBookId : text})}
          value={this.state.scannedBookId}/>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={()=>{
            this.getCameraPermissions("BookId")
          }}>
          <Text style={styles.buttonText}>Scan</Text>
        </TouchableOpacity>
        </View>

        <View style={styles.inputView}>
        <TextInput
          style={styles.inputBox}
          placeholder="Student Id"
          onChangeText = {text => this.setState({scannedStudentId : text})}
          value={this.state.scannedStudentId}/>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={()=>{
            this.getCameraPermissions("StudentId")
          }}>
          <Text style={styles.buttonText}>Scan</Text>
        </TouchableOpacity>
        </View>
        <Text style={styles.transactionAlert}>{this.state.transactionMessage}</Text>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={async()=>{
            var transactionMessage = await this.handleTransaction();
            this.setState({
              scannedBookId : '',
              scannedStudentId : ''
             })
          }}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
      )
    }
  }
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  displayText:{
    fontSize: 15,
    textDecorationLine: 'underline'
  },
  scanButton:{
    backgroundColor: '#2196F3',
    padding: 10,
    margin: 10
  },
  buttonText:{
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10
  },
  inputView:{
    flexDirection: 'row',
    margin: 20
  },
  inputBox:{
    width: 200,
    height: 40,
    borderWidth: 1.5,
    borderRightWidth: 0,
    fontSize: 20
  },
  scanButton:{
    backgroundColor: '#66BB6A',
    width: 50,
    borderWidth: 1.5,
    borderLeftWidth: 0
  },
  submitButton:{
    backgroundColor: '#FBC02D',
    width: 100,
    height:50
  },
  submitButtonText:{
    padding: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight:"bold",
    color: 'white'
  }
});
